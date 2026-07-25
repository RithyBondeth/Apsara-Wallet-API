import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, gte, isNull, lte, or, SQL } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { categories, transactions, wallets } from '../../database/schema';
import {
  CreateTransactionDto,
  ListTransactionsQuery,
  UpdateTransactionDto,
} from './dto/transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async list(userId: string, query: ListTransactionsQuery) {
    const filters: SQL[] = [eq(transactions.userId, userId)];
    if (query.type) filters.push(eq(transactions.type, query.type));
    if (query.categoryId)
      filters.push(eq(transactions.categoryId, query.categoryId));
    if (query.walletId)
      filters.push(eq(transactions.walletId, query.walletId));
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
      this.db
        .select({ total: count() })
        .from(transactions)
        .where(where),
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

    const [row] = await this.db
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
    return row;
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    await this.findOne(userId, id);
    if (dto.walletId) await this.assertWalletOwned(userId, dto.walletId);
    if (dto.categoryId) await this.assertCategoryUsable(userId, dto.categoryId);

    const [row] = await this.db
      .update(transactions)
      .set({
        ...dto,
        date: dto.date ? new Date(dto.date) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id))
      .returning();
    return row;
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.db.delete(transactions).where(eq(transactions.id, id));
    return { success: true };
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
