import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { RecurringModule } from './modules/recurring/recurring.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    DatabaseModule,
    AuthModule,
    CategoriesModule,
    WalletsModule,
    TransactionsModule,
    BudgetsModule,
    RecurringModule,
  ],
})
export class AppModule {}
