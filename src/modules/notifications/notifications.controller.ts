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
import { EmitInsightDto } from './dto/emit-insight.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List notifications (newest first)' })
  list(@CurrentUser() user: IAuthUser) {
    return this.notifications.list(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(
    @CurrentUser() user: IAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser() user: IAuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Post('insight')
  @ApiOperation({
    summary: 'Post the monthly insight digest (deduped per period)',
  })
  emitInsight(@CurrentUser() user: IAuthUser, @Body() dto: EmitInsightDto) {
    return this.notifications.emitInsight(user.id, dto);
  }

  @Post('devices')
  @ApiOperation({ summary: 'Register this device for push notifications' })
  registerDevice(
    @CurrentUser() user: IAuthUser,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.push.registerToken(user.id, dto.token, dto.platform);
  }

  @Delete('devices/:token')
  @ApiOperation({ summary: 'Unregister a device (e.g. on logout)' })
  unregisterDevice(
    @CurrentUser() user: IAuthUser,
    @Param('token') token: string,
  ) {
    return this.push.removeToken(user.id, token);
  }
}
