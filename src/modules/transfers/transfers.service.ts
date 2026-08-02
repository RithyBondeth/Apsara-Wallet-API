import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { transfers, wallets } from '../../database/schema';
import { CreateTransferDto } from './dto/transfer.dto';

@Injectable()
export class TransfersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** The user's transfers, newest first. Optionally scoped to one wallet. */
  async list(userId: string, walletId?: string) {
    const filter = walletId
      ? and(
          eq(transfers.userId, userId),
          or(
            eq(transfers.fromWalletId, walletId),
            eq(transfers.toWalletId, walletId),
          ),
        )
      : eq(transfers.userId, userId);
    return this.db
      .select()
      .from(transfers)
      .where(filter)
      .orderBy(desc(transfers.date));
  }

  /**
   * Moves [amountKhr] from one of the user's wallets to another, atomically:
   * record the transfer and adjust both balances in a single DB transaction so
   * they can never drift. Transfers are net-zero and stay out of the ledger.
   */
  async create(userId: string, dto: CreateTransferDto) {
    if (dto.fromWalletId === dto.toWalletId) {
      throw new BadRequestException('Cannot transfer to the same wallet');
    }
    // Both wallets must belong to the user.
    const owned = await this.db
      .select({ id: wallets.id })
      .from(wallets)
      .where(
        and(
          eq(wallets.userId, userId),
          or(eq(wallets.id, dto.fromWalletId), eq(wallets.id, dto.toWalletId)),
        ),
      );
    if (owned.length !== 2) {
      throw new BadRequestException('Both wallets must be your own');
    }

    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(transfers)
        .values({
          userId,
          fromWalletId: dto.fromWalletId,
          toWalletId: dto.toWalletId,
          amountKhr: dto.amountKhr,
          note: dto.note,
          date: new Date(dto.date),
        })
        .returning();
      await tx
        .update(wallets)
        .set({
          balanceKhr: sql`${wallets.balanceKhr} - ${dto.amountKhr}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, dto.fromWalletId));
      await tx
        .update(wallets)
        .set({
          balanceKhr: sql`${wallets.balanceKhr} + ${dto.amountKhr}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, dto.toWalletId));
      return row;
    });
  }
}
