import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import {
  categories,
  recurringRules,
  transactions,
  wallets,
} from '../../database/schema';
import { CreateRecurringDto, UpdateRecurringDto } from './dto/recurring.dto';

/** Signed riel effect on a wallet: income adds, expense subtracts. */
function signedAmount(type: string, amountKhr: number): number {
  return type === 'income' ? amountKhr : -amountKhr;
}

/** Never post more than this many catch-up occurrences for one rule in a run. */
const MAX_CATCHUP = 120;

/** The occurrence after [due] for a given frequency (UTC). */
function nextOccurrence(due: Date, frequency: string): Date {
  if (frequency === 'weekly') {
    return new Date(due.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  // monthly: same day next month, clamped to that month's last day
  // (e.g. Jan 31 → Feb 28) so the anchor day never drifts forward.
  const day = due.getUTCDate();
  const target = new Date(
    Date.UTC(
      due.getUTCFullYear(),
      due.getUTCMonth() + 1,
      1,
      due.getUTCHours(),
      due.getUTCMinutes(),
      due.getUTCSeconds(),
    ),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

@Injectable()
export class RecurringService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** The user's recurring rules, soonest-due first. */
  async list(userId: string) {
    return this.db
      .select()
      .from(recurringRules)
      .where(eq(recurringRules.userId, userId))
      .orderBy(asc(recurringRules.nextDue));
  }

  async findOne(userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(recurringRules)
      .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, userId)));
    if (!row) throw new NotFoundException('Recurring rule not found');
    return row;
  }

  async create(userId: string, dto: CreateRecurringDto) {
    await this.assertWalletOwned(userId, dto.walletId);
    await this.assertCategoryUsable(userId, dto.categoryId);
    const [row] = await this.db
      .insert(recurringRules)
      .values({
        userId,
        walletId: dto.walletId,
        categoryId: dto.categoryId,
        title: dto.title,
        amountKhr: dto.amountKhr,
        type: dto.type,
        frequency: dto.frequency,
        nextDue: new Date(dto.nextDue),
        note: dto.note,
      })
      .returning();
    return row;
  }

  async update(userId: string, id: string, dto: UpdateRecurringDto) {
    await this.findOne(userId, id);
    if (dto.walletId) await this.assertWalletOwned(userId, dto.walletId);
    if (dto.categoryId) await this.assertCategoryUsable(userId, dto.categoryId);
    const [row] = await this.db
      .update(recurringRules)
      .set({
        ...dto,
        nextDue: dto.nextDue ? new Date(dto.nextDue) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(recurringRules.id, id))
      .returning();
    return row;
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.db.delete(recurringRules).where(eq(recurringRules.id, id));
    return { success: true };
  }

  /**
   * Materialize every occurrence that has come due (nextDue <= now) into real
   * ledger transactions for ONE user, moving wallet balances, then advance
   * each rule's nextDue past now. Idempotent between calls: a rule only posts
   * occurrences whose due date has actually passed, and each posting advances
   * the anchor.
   *
   * Catch-up is capped per rule (a long-dormant account never floods the
   * ledger); the cap is reported back so callers can surface it.
   */
  async runDue(userId: string, asOf?: Date) {
    const now = asOf ?? new Date();
    const due = await this.db
      .select()
      .from(recurringRules)
      .where(
        and(
          eq(recurringRules.userId, userId),
          lte(recurringRules.nextDue, now),
        ),
      )
      .orderBy(asc(recurringRules.nextDue));

    return this.materialize(due, now);
  }

  /**
   * Materialize due occurrences for EVERY user — the scheduler entry point.
   * Same semantics as [runDue] but not scoped to one user; each rule carries
   * its own userId. Returns the aggregate posted/rulesRun/usersAffected.
   */
  async runDueAll(asOf?: Date) {
    const now = asOf ?? new Date();
    const due = await this.db
      .select()
      .from(recurringRules)
      .where(lte(recurringRules.nextDue, now))
      .orderBy(asc(recurringRules.nextDue));

    const result = await this.materialize(due, now);
    const usersAffected = new Set(due.map((r) => r.userId)).size;
    return { ...result, usersAffected };
  }

  /**
   * Shared core: posts each due rule's missed occurrences atomically (one DB
   * transaction per rule so a single rule's failure can't corrupt the rest),
   * moving that rule's wallet and advancing its nextDue. userId is read from
   * each rule, so this works whether called for one user or all.
   */
  private async materialize(
    due: (typeof recurringRules.$inferSelect)[],
    now: Date,
  ) {
    let posted = 0;
    let capped = false;

    for (const rule of due) {
      await this.db.transaction(async (tx) => {
        let cursor = rule.nextDue;
        let delta = 0;
        let count = 0;
        while (cursor <= now && count < MAX_CATCHUP) {
          await tx.insert(transactions).values({
            userId: rule.userId,
            walletId: rule.walletId,
            categoryId: rule.categoryId,
            title: rule.title,
            amountKhr: rule.amountKhr,
            type: rule.type,
            note: rule.note,
            date: cursor,
          });
          delta += signedAmount(rule.type, rule.amountKhr);
          cursor = nextOccurrence(cursor, rule.frequency);
          count++;
        }
        if (count === MAX_CATCHUP && cursor <= now) capped = true;

        if (delta !== 0) {
          await tx
            .update(wallets)
            .set({
              balanceKhr: sql`${wallets.balanceKhr} + ${delta}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(wallets.id, rule.walletId),
                eq(wallets.userId, rule.userId),
              ),
            );
        }
        await tx
          .update(recurringRules)
          .set({ nextDue: cursor, updatedAt: new Date() })
          .where(eq(recurringRules.id, rule.id));

        posted += count;
      });
    }

    return { posted, rulesRun: due.length, capped };
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
