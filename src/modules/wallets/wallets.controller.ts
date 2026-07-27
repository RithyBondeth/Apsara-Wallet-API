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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { IAuthUser } from '../../common/interfaces/jwt-payload';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletsService } from './wallets.service';
import { CreateWalletDto, UpdateWalletDto } from './dto/wallet.dto';

@ApiTags('wallets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallets')
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  @Get()
  list(@CurrentUser() user: IAuthUser) {
    return this.wallets.list(user.id);
  }

  @Get('summary')
  summary(@CurrentUser() user: IAuthUser) {
    return this.wallets.summary(user.id);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: IAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.wallets.findOne(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: IAuthUser, @Body() dto: CreateWalletDto) {
    return this.wallets.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: IAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWalletDto,
  ) {
    return this.wallets.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: IAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.wallets.remove(user.id, id);
  }
}
