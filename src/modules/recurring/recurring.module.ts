import { Module } from '@nestjs/common';
import { RecurringController } from './recurring.controller';
import { RecurringSchedulerService } from './recurring-scheduler.service';
import { RecurringService } from './recurring.service';

@Module({
  controllers: [RecurringController],
  providers: [RecurringService, RecurringSchedulerService],
})
export class RecurringModule {}
