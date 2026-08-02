import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { IAuthUser } from '../../common/interfaces/jwt-payload';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDTO, ListBudgetsQuery } from './dtos/budget.dto';

@ApiTags('budgets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  @ApiOperation({ summary: 'List category budgets for a month (with spend)' })
  list(@CurrentUser() user: IAuthUser, @Query() query: ListBudgetsQuery) {
    return this.budgets.list(user.id, query.month);
  }

  @Post()
  @ApiOperation({ summary: 'Set (create or update) a category budget' })
  upsert(@CurrentUser() user: IAuthUser, @Body() dto: CreateBudgetDTO) {
    return this.budgets.upsert(user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a category budget' })
  remove(
    @CurrentUser() user: IAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.budgets.remove(user.id, id);
  }
}
