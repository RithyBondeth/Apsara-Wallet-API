import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gte, isNull, lt, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { budgets, categories, transactions } from '../../database/schema';
import { CreateBudgetDTO } from './dtos/budget.dto';

/** Current calendar month as "YYYY-MM" (UTC). */
function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Half-open UTC range [start, end) for a "YYYY-MM" month label. */
function monthRange(month: string): { start: Date; end: Date } {
  const [year, m] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, m - 1, 1)),
    end: new Date(Date.UTC(year, m, 1)),
  };
}

@Injectable()
export class BudgetsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * The user's per-category budgets for a month, each with `spentKhr` computed
   * live from the ledger (expenses in that category during the month).
   */
  async list(userId: string, month?: string) {
    const m = month ?? currentMonth();
    const { start, end } = monthRange(m);

    const [rows, spentRows] = await Promise.all([
      this.db
        .select()
        .from(budgets)
        .where(and(eq(budgets.userId, userId), eq(budgets.month, m))),
      this.db
        .select({
          categoryId: transactions.categoryId,
          spent: sql<number>`coalesce(sum(${transactions.amountKhr}), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.type, 'expense'),
            gte(transactions.date, start),
            lt(transactions.date, end),
          ),
        )
        .groupBy(transactions.categoryId),
    ]);

    const spentByCategory = new Map(
      spentRows.map((r) => [r.categoryId, Number(r.spent)]),
    );

    return {
      month: m,
      budgets: rows.map((b) => ({
        ...b,
        spentKhr: spentByCategory.get(b.categoryId) ?? 0,
      })),
    };
  }

  /** Create or update the budget for (user, month, category). */
  async upsert(userId: string, dto: CreateBudgetDTO) {
    await this.assertCategoryUsable(userId, dto.categoryId);
    const [row] = await this.db
      .insert(budgets)
      .values({
        userId,
        categoryId: dto.categoryId,
        month: dto.month,
        limitKhr: dto.limitKhr,
      })
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.month, budgets.categoryId],
        set: { limitKhr: dto.limitKhr, updatedAt: new Date() },
      })
      .returning();
    return row;
  }

  async remove(userId: string, id: string) {
    const [row] = await this.db
      .select({ id: budgets.id })
      .from(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
    if (!row) throw new NotFoundException('Budget not found');
    await this.db.delete(budgets).where(eq(budgets.id, id));
    return { success: true };
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
