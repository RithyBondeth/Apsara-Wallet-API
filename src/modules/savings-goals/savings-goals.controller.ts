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
import {
  AddFundsDto,
  CreateSavingsGoalDto,
  UpdateSavingsGoalDto,
} from './dto/savings-goal.dto';
import { SavingsGoalsService } from './savings-goals.service';

@ApiTags('savings-goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('savings-goals')
export class SavingsGoalsController {
  constructor(private readonly goals: SavingsGoalsService) {}

  @Get()
  @ApiOperation({ summary: 'List savings goals' })
  list(@CurrentUser() user: IAuthUser) {
    return this.goals.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a savings goal' })
  create(@CurrentUser() user: IAuthUser, @Body() dto: CreateSavingsGoalDto) {
    return this.goals.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a savings goal (name/target/icon/color)' })
  update(
    @CurrentUser() user: IAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSavingsGoalDto,
  ) {
    return this.goals.update(user.id, id, dto);
  }

  @Post(':id/add-funds')
  @ApiOperation({ summary: 'Add funds to a savings goal (tracking only)' })
  addFunds(
    @CurrentUser() user: IAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddFundsDto,
  ) {
    return this.goals.addFunds(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a savings goal' })
  remove(
    @CurrentUser() user: IAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.goals.remove(user.id, id);
  }
}
