import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { IAuthUser } from '../../common/interfaces/jwt-payload';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTransferDto } from './dto/transfer.dto';
import { TransfersService } from './transfers.service';

@ApiTags('transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get()
  @ApiOperation({ summary: 'List transfers (optionally for one wallet)' })
  list(@CurrentUser() user: IAuthUser, @Query('walletId') walletId?: string) {
    return this.transfers.list(user.id, walletId);
  }

  @Post()
  @ApiOperation({ summary: 'Move money between two of your wallets' })
  create(@CurrentUser() user: IAuthUser, @Body() dto: CreateTransferDto) {
    return this.transfers.create(user.id, dto);
  }
}
