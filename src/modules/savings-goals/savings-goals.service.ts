import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { savingsGoals } from '../../database/schema';
import {
  AddFundsDto,
  CreateSavingsGoalDto,
  UpdateSavingsGoalDto,
} from './dto/savings-goal.dto';

/**
 * Savings goals are tracking only — they never move money or touch wallets/the
 * ledger. `savedKhr` is a plain running total the user nudges with "add funds".
 */
@Injectable()
export class SavingsGoalsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** The user's goals, oldest first (stable insertion order). */
  async list(userId: string) {
    return this.db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.userId, userId))
      .orderBy(asc(savingsGoals.createdAt));
  }

  async findOne(userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(savingsGoals)
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));
    if (!row) throw new NotFoundException('Savings goal not found');
    return row;
  }

  async create(userId: string, dto: CreateSavingsGoalDto) {
    const [row] = await this.db
      .insert(savingsGoals)
      .values({
        userId,
        name: dto.name,
        targetKhr: dto.targetKhr,
        savedKhr: dto.savedKhr ?? 0,
        icon: dto.icon,
        color: dto.color,
      })
      .returning();
    return row;
  }

  async update(userId: string, id: string, dto: UpdateSavingsGoalDto) {
    await this.findOne(userId, id);
    const [row] = await this.db
      .update(savingsGoals)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(savingsGoals.id, id))
      .returning();
    return row;
  }

  /** Adds [amountKhr] to the goal's saved total (never negative). */
  async addFunds(userId: string, id: string, dto: AddFundsDto) {
    await this.findOne(userId, id);
    const [row] = await this.db
      .update(savingsGoals)
      .set({
        savedKhr: sql`${savingsGoals.savedKhr} + ${dto.amountKhr}`,
        updatedAt: new Date(),
      })
      .where(eq(savingsGoals.id, id))
      .returning();
    return row;
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.db.delete(savingsGoals).where(eq(savingsGoals.id, id));
    return { success: true };
  }
}
