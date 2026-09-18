import { IAuthUser } from '../jwt-payload';
import { ISuccessResponse } from './auth.interface';

export type { ISuccessResponse };
import {
  CreateBudgetDTO,
  ListBudgetsQuery,
} from '../../../modules/budgets/dtos/budget.dto';

/** The raw `budgets` row — what upsert/remove operate on. */
export interface IBudgetRow {
  id: string;
  userId: string;
  categoryId: string;
  month: string;
  limitKhr: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A per-category budget for a month plus what the ledger actually spent in
 * that category during `month` (live, computed by the service). Only `list`
 * returns this shape — `upsert` returns the raw {@link IBudgetRow}.
 */
export interface IBudgetWithSpend extends IBudgetRow {
  spentKhr: number;
}

export interface IMonthBudgets {
  month: string;
  budgets: IBudgetWithSpend[];
}

/** The signed-in user's monthly category budgets. */
export interface IBudgetsController {
  /** Raw `budgets` rows for a month, each with live `spentKhr`. */
  list(user: IAuthUser, query: ListBudgetsQuery): Promise<IMonthBudgets>;
  /** Returns the raw upserted row — spend is only computed by `list`. */
  upsert(user: IAuthUser, dto: CreateBudgetDTO): Promise<IBudgetRow>;
  remove(user: IAuthUser, id: string): Promise<ISuccessResponse>;
}
