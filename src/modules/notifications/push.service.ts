import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  cert,
  getApps,
  initializeApp,
  ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { and, eq, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { deviceTokens } from '../../database/schema';
import { EmitNotification } from './notification-templates';

/**
 * Sends push notifications via Firebase Cloud Messaging and owns the device
 * token registry. Degrades gracefully: if no service-account credential is
 * configured (`FIREBASE_SERVICE_ACCOUNT`), pushes are skipped — the in-app
 * inbox still works, nothing throws. Token register/unregister always work
 * regardless, so the mobile client can be wired before FCM creds exist.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const raw = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT');
    if (!raw) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT not set — push delivery disabled (inbox still works).',
      );
      return;
    }
    try {
      const serviceAccount = JSON.parse(raw) as ServiceAccount;
      if (getApps().length === 0) {
        initializeApp({ credential: cert(serviceAccount) });
      }
      this.enabled = true;
      this.logger.log('Firebase Cloud Messaging initialized — push enabled.');
    } catch (err) {
      this.logger.error(
        'Failed to initialize Firebase Admin — push disabled.',
        err as Error,
      );
    }
  }

  /** Register (or repoint) an FCM token for a user. Idempotent per token. */
  async registerToken(userId: string, token: string, platform?: string) {
    await this.db
      .insert(deviceTokens)
      .values({ userId, token, platform })
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: { userId, platform, updatedAt: new Date() },
      });
    return { success: true };
  }

  /** Remove a token (called on logout). No-op if it isn't the user's. */
  async removeToken(userId: string, token: string) {
    await this.db
      .delete(deviceTokens)
      .where(
        and(eq(deviceTokens.token, token), eq(deviceTokens.userId, userId)),
      );
    return { success: true };
  }

  /**
   * Fire a push to all of a user's devices for a freshly-emitted notification.
   * Fire-and-forget from the caller's perspective — never throws. Prunes tokens
   * FCM reports as no-longer-registered.
   */
  async sendToUser(
    userId: string,
    n: EmitNotification,
    notificationId: string,
  ) {
    if (!this.enabled) return;
    try {
      const rows = await this.db
        .select({ token: deviceTokens.token })
        .from(deviceTokens)
        .where(eq(deviceTokens.userId, userId));
      if (rows.length === 0) return;

      const tokens = rows.map((r) => r.token);
      const res = await getMessaging().sendEachForMulticast({
        tokens,
        notification: { title: n.title, body: n.body },
        // FCM data values must be strings; the client refetches the inbox.
        data: { type: n.type, notificationId },
      });

      const stale = res.responses
        .map((r, i) => ({ r, token: tokens[i] }))
        .filter(
          ({ r }) =>
            !r.success &&
            (r.error?.code === 'messaging/registration-token-not-registered' ||
              r.error?.code === 'messaging/invalid-registration-token'),
        )
        .map(({ token }) => token);

      if (stale.length > 0) {
        await this.db
          .delete(deviceTokens)
          .where(inArray(deviceTokens.token, stale));
      }
    } catch (err) {
      this.logger.error('Push send failed', err as Error);
    }
  }
}
