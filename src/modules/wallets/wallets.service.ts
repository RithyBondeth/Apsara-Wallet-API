import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB, DrizzleTx } from '../../database/database.module';
import { wallets } from '../../database/schema';
import { CreateWalletDto, UpdateWalletDto } from './dto/wallet.dto';

@Injectable()
export class WalletsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  list(userId: string) {
    return this.db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .orderBy(wallets.createdAt);
  }

  async summary(userId: string) {
    const rows = await this.list(userId);
    return {
      totalBalanceKhr: rows.reduce((sum, w) => sum + w.balanceKhr, 0),
      totalBalanceUsd: rows.reduce((sum, w) => sum + w.balanceUsd, 0),
      wallets: rows,
    };
  }

  async findOne(userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(wallets)
      .where(and(eq(wallets.id, id), eq(wallets.userId, userId)));
    if (!row) throw new NotFoundException('Wallet not found');
    return row;
  }

  async create(userId: string, dto: CreateWalletDto) {
    return this.db.transaction(async (tx) => {
      if (dto.isPrimary) await this.clearPrimary(tx, userId);
      const [row] = await tx
        .insert(wallets)
        .values({ ...dto, userId })
        .returning();
      return row;
    });
  }

  async update(userId: string, id: string, dto: UpdateWalletDto) {
    await this.findOne(userId, id);
    return this.db.transaction(async (tx) => {
      if (dto.isPrimary) await this.clearPrimary(tx, userId, id);
      const [row] = await tx
        .update(wallets)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(wallets.id, id))
        .returning();
      return row;
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    // FK on transactions is onDelete: 'restrict' — Postgres blocks deletion of a
    // wallet that still has transactions, surfaced as a 500-level DB error.
    await this.db.delete(wallets).where(eq(wallets.id, id));
    return { success: true };
  }

  private clearPrimary(tx: DrizzleTx, userId: string, exceptId?: string) {
    const where = exceptId
      ? and(eq(wallets.userId, userId), ne(wallets.id, exceptId))
      : eq(wallets.userId, userId);
    return tx.update(wallets).set({ isPrimary: false }).where(where);
  }
}
