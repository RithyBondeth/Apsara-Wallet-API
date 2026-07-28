import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  gte,
  isNull,
  lt,
  lte,
  or,
  sql,
  SQL,
} from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB, DrizzleTx } from '../../database/database.module';
import {
  budgets,
  categories,
  transactions,
  wallets,
} from '../../database/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationTemplates } from '../notifications/notification-templates';
import {
  CreateTransactionDto,
  ListTransactionsQuery,
  UpdateTransactionDto,
} from './dto/transaction.dto';

/** Signed riel effect of a transaction on its wallet: income adds, expense subtracts. */
function signedAmount(type: string, amountKhr: number): number {
  return type === 'income' ? amountKhr : -amountKhr;
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly notifications: NotificationsService,
  ) {}

  async listAllCategory(userId: string, query: ListTransactionsQuery) {
    const filters: SQL[] = [eq(transactions.userId, userId)];
    if (query.type) filters.push(eq(transactions.type, query.type));
    if (query.categoryId)
      filters.push(eq(transactions.categoryId, query.categoryId));
    if (query.walletId) filters.push(eq(transactions.walletId, query.walletId));
    if (query.from) filters.push(gte(transactions.date, new Date(query.from)));
    if (query.to) filters.push(lte(transactions.date, new Date(query.to)));

    const where = and(...filters);
    const offset = (query.page - 1) * query.limit;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(transactions)
        .where(where)
        .orderBy(desc(transactions.date))
        .limit(query.limit)
        .offset(offset),
      this.db.select({ total: count() }).from(transactions).where(where),
    ]);

    return {
      data: rows,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    if (!row) throw new NotFoundException('Transaction not found');
    return row;
  }

  async create(userId: string, dto: CreateTransactionDto) {
    await this.assertWalletOwned(userId, dto.walletId);
    await this.assertCategoryUsable(userId, dto.categoryId);

    // Insert the transaction and move the wallet balance atomically, so the
    // ledger and the wallet's balanceKhr can never drift apart.
    const row = await this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(transactions)
        .values({
          userId,
          walletId: dto.walletId,
          categoryId: dto.categoryId,
          title: dto.title,
          amountKhr: dto.amountKhr,
          type: dto.type,
          note: dto.note,
          date: new Date(dto.date),
        })
        .returning();
      await this.applyToWallet(
        tx,
        userId,
        dto.walletId,
        signedAmount(dto.type, dto.amountKhr),
      );
      return inserted;
    });

    // After it's committed (so the spend total includes it), alert if this
    // expense just pushed the category over its monthly budget.
    if (dto.type === 'expense') {
      await this.maybeEmitBudgetAlert(
        userId,
        dto.categoryId,
        dto.amountKhr,
        new Date(dto.date),
      );
    }
    return row;
  }

  /**
   * Emits a budget alert when [amountKhr] pushed the category's spend for its
   * month from under its budget to at/over it — fires once, only on the
   * transaction that crosses. No budget set → nothing happens. Never lets a
   * notification failure break the transaction create.
   */
  private async maybeEmitBudgetAlert(
    userId: string,
    categoryId: string,
    amountKhr: number,
    date: Date,
  ) {
    try {
      const month = `${date.getUTCFullYear()}-${String(
        date.getUTCMonth() + 1,
      ).padStart(2, '0')}`;
      const start = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
      );
      const end = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
      );

      const [budgetRow] = await this.db
        .select({ limitKhr: budgets.limitKhr })
        .from(budgets)
        .where(
          and(
            eq(budgets.userId, userId),
            eq(budgets.month, month),
            eq(budgets.categoryId, categoryId),
          ),
        );
      if (!budgetRow) return;

      const [{ spent }] = await this.db
        .select({
          spent: sql<number>`coalesce(sum(${transactions.amountKhr}), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.categoryId, categoryId),
            eq(transactions.type, 'expense'),
            gte(transactions.date, start),
            lt(transactions.date, end),
          ),
        );

      const total = Number(spent);
      const limit = budgetRow.limitKhr;
      // Only the crossing transaction: now at/over, but was under before it.
      if (total >= limit && total - amountKhr < limit) {
        const [cat] = await this.db
          .select({ name: categories.name })
          .from(categories)
          .where(eq(categories.id, categoryId));
        await this.notifications.emit(
          userId,
          NotificationTemplates.budgetAlert(cat?.name ?? 'category'),
        );
      }
    } catch (err) {
      this.logger.error('Failed to emit budget alert', err as Error);
    }
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    const existing = await this.findOne(userId, id);
    if (dto.walletId) await this.assertWalletOwned(userId, dto.walletId);
    if (dto.categoryId) await this.assertCategoryUsable(userId, dto.categoryId);

    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(transactions)
        .set({
          ...dto,
          date: dto.date ? new Date(dto.date) : undefined,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, id))
        .returning();

      // Reverse the old effect, then apply the new one — handles amount, type
      // and wallet changes (including moving a tx between wallets).
      const oldDelta = signedAmount(existing.type, existing.amountKhr);
      const newDelta = signedAmount(
        dto.type ?? existing.type,
        dto.amountKhr ?? existing.amountKhr,
      );
      await this.applyToWallet(tx, userId, existing.walletId, -oldDelta);
      await this.applyToWallet(
        tx,
        userId,
        dto.walletId ?? existing.walletId,
        newDelta,
      );
      return row;
    });
  }

  async remove(userId: string, id: string) {
    const existing = await this.findOne(userId, id);
    return this.db.transaction(async (tx) => {
      await tx.delete(transactions).where(eq(transactions.id, id));
      // Reverse this transaction's effect on the wallet balance.
      await this.applyToWallet(
        tx,
        userId,
        existing.walletId,
        -signedAmount(existing.type, existing.amountKhr),
      );
      return { success: true };
    });
  }

  /** Adds [delta] riel to a wallet's balance (delta may be negative). */
  private async applyToWallet(
    tx: DrizzleTx,
    userId: string,
    walletId: string,
    delta: number,
  ) {
    if (delta === 0) return;
    await tx
      .update(wallets)
      .set({
        balanceKhr: sql`${wallets.balanceKhr} + ${delta}`,
        updatedAt: new Date(),
      })
      .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)));
  }

  private async assertWalletOwned(userId: string, walletId: string) {
    const [row] = await this.db
      .select({ id: wallets.id })
      .from(wallets)
      .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)));
    if (!row) throw new BadRequestException('Wallet not found');
  }

  /** Category must be a system category or one the user owns. */
  private async assertCategoryUsable(userId: string, categoryId: string) {
    const [row] = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.id, categoryId),
          or(isNull(categories.userId), eq(categories.userId, userId)),
        ),
      );
    if (!row) throw new BadRequestException('Category not found');
  }
}
