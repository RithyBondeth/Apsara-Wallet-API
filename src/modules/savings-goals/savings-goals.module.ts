import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SavingsGoalsController } from './savings-goals.controller';
import { SavingsGoalsService } from './savings-goals.service';

@Module({
  imports: [NotificationsModule],
  controllers: [SavingsGoalsController],
  providers: [SavingsGoalsService],
})
export class SavingsGoalsModule {}
