import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { RecurringModule } from './modules/recurring/recurring.module';
import { SavingsGoalsModule } from './modules/savings-goals/savings-goals.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TransfersModule } from './modules/transfers/transfers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    // Storage/config for ThrottlerGuard. The guard is applied only to the
    // sensitive auth endpoints (see AuthController), not globally, so normal
    // app traffic (which bursts on dashboard open) is never rate-limited.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    DatabaseModule,
    AuthModule,
    CategoriesModule,
    WalletsModule,
    TransactionsModule,
    BudgetsModule,
    RecurringModule,
    SavingsGoalsModule,
    NotificationsModule,
    TransfersModule,
  ],
})
export class AppModule {}
