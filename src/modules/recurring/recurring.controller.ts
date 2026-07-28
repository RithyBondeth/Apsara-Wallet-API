import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { IAuthUser } from '../../common/interfaces/jwt-payload';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateRecurringDto, UpdateRecurringDto } from './dto/recurring.dto';
import { RecurringService } from './recurring.service';

@ApiTags('recurring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recurring')
export class RecurringController {
  constructor(private readonly recurring: RecurringService) {}

  @Get()
  @ApiOperation({ summary: 'List recurring rules (soonest due first)' })
  list(@CurrentUser() user: IAuthUser) {
    return this.recurring.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a recurring rule' })
  create(@CurrentUser() user: IAuthUser, @Body() dto: CreateRecurringDto) {
    return this.recurring.create(user.id, dto);
  }

  @Post('run')
  @ApiOperation({
    summary: 'Post every due occurrence to the ledger and advance rules',
  })
  run(@CurrentUser() user: IAuthUser) {
    return this.recurring.runDue(user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a recurring rule' })
  update(
    @CurrentUser() user: IAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecurringDto,
  ) {
    return this.recurring.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a recurring rule' })
  remove(
    @CurrentUser() user: IAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recurring.remove(user.id, id);
  }
}
