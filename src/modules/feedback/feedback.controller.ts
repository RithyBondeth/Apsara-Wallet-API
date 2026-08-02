import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { IAuthUser } from '../../common/interfaces/jwt-payload';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateFeedbackDto } from './dto/feedback.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post()
  @ApiOperation({ summary: 'Submit an in-app rating (with optional comment)' })
  create(@CurrentUser() user: IAuthUser, @Body() dto: CreateFeedbackDto) {
    return this.feedback.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the signed-in user's own submissions" })
  listMine(@CurrentUser() user: IAuthUser) {
    return this.feedback.listMine(user.id);
  }
}
