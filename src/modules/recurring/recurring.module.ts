import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RecurringController } from './recurring.controller';
import { RecurringSchedulerService } from './recurring-scheduler.service';
import { RecurringService } from './recurring.service';

@Module({
  imports: [NotificationsModule],
  controllers: [RecurringController],
  providers: [RecurringService, RecurringSchedulerService],
})
export class RecurringModule {}
