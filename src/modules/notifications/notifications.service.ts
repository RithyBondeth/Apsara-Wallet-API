import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { notifications } from '../../database/schema';
import { EmitNotification } from './notification-templates';
import { PushService } from './push.service';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly push: PushService,
  ) {}

  /** The user's notifications, newest first. */
  async list(userId: string) {
    return this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(100);
  }

  /**
   * Create a notification for a user. Called by other services on real events
   * (recurring posted, savings milestone, budget alert). Never throws to the
   * caller's critical path — a failed insert must not roll back the event that
   * triggered it, so callers should wrap this in their own catch if needed.
   */
  async emit(userId: string, n: EmitNotification) {
    const [row] = await this.db
      .insert(notifications)
      .values({
        userId,
        type: n.type,
        data: n.data,
        title: n.title,
        body: n.body,
        icon: n.icon,
        color: n.color,
      })
      .returning();
    // Also deliver a push (no-op when FCM isn't configured). sendToUser never
    // throws, so this can't affect the persisted notification.
    void this.push.sendToUser(userId, n, row.id);
    return row;
  }

  async markRead(userId: string, id: string) {
    const [row] = await this.db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    if (!row) throw new NotFoundException('Notification not found');
    return row;
  }

  async markAllRead(userId: string) {
    await this.db
      .update(notifications)
      .set({ read: true })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.read, false)),
      );
    return { success: true };
  }
}
