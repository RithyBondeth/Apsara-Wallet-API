import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, eq, ne } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB, DrizzleTx } from '../../database/database.module';
import { transactions, wallets } from '../../database/schema';
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
    // FK on transactions is onDelete: 'restrict'. Rather than let Postgres throw
    // a raw 500, check first and surface a friendly 409 the client can explain.
    const [{ value: txCount }] = await this.db
      .select({ value: count() })
      .from(transactions)
      .where(eq(transactions.walletId, id));
    if (txCount > 0) {
      throw new ConflictException(
        'This wallet still has transactions. Move or delete them first.',
      );
    }
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
