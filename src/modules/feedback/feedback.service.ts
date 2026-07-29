import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { feedback } from '../../database/schema';
import { CreateFeedbackDto } from './dto/feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Record one rating submission for the given user. */
  async create(userId: string, dto: CreateFeedbackDto) {
    const [row] = await this.db
      .insert(feedback)
      .values({
        userId,
        rating: dto.rating,
        comment: dto.comment,
        appVersion: dto.appVersion,
        platform: dto.platform,
      })
      .returning();
    return row;
  }

  /** The signed-in user's own submissions, newest first. */
  async listMine(userId: string) {
    return this.db
      .select()
      .from(feedback)
      .where(eq(feedback.userId, userId))
      .orderBy(desc(feedback.createdAt));
  }
}
