import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/**
 * Password-reset email contents. Pure (no I/O) so it's unit-testable. The
 * token is embedded in a deep link; the raw token is also shown as a fallback
 * for flows that paste a code.
 */
export function buildPasswordResetEmail(token: string, resetUrlBase: string) {
  const link = `${resetUrlBase}${encodeURIComponent(token)}`;
  const subject = 'Reset your Apsara Wallet password';
  const text =
    `Reset your Apsara Wallet password.\n\n` +
    `Open this link to choose a new password (valid for 15 minutes):\n${link}\n\n` +
    `If you didn’t request this, you can safely ignore this email.`;
  const html = `<!doctype html>
<html><body style="margin:0;background:#F4F6F5;font-family:Arial,Helvetica,sans-serif;color:#1A1A1A;">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
    <h1 style="font-size:20px;color:#0B5B3D;margin:0 0 16px;">Reset your password</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">
      We received a request to reset your Apsara Wallet password. Tap the button
      below to choose a new one. This link expires in 15 minutes.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${link}" style="display:inline-block;background:#27A79A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;">Reset password</a>
    </p>
    <p style="font-size:13px;color:#666;line-height:1.6;margin:0;">
      If you didn’t request this, you can safely ignore this email — your
      password won’t change.
    </p>
  </div>
</body></html>`;
  return { subject, html, text };
}

/**
 * Sends transactional email via Resend. Degrades gracefully: with no
 * `RESEND_API_KEY` configured, sends are skipped (in dev the reset token is
 * still returned in the API response, so the flow is testable without email).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend?: Resend;
  private readonly from: string;
  private readonly resetUrlBase: string;

  constructor(config: ConfigService) {
    const key = config.get<string>('RESEND_API_KEY');
    this.from =
      config.get<string>('RESEND_FROM') ??
      'Apsara Wallet <onboarding@resend.dev>';
    this.resetUrlBase =
      config.get<string>('PASSWORD_RESET_URL') ??
      'apsarawallet://reset-password?token=';
    if (key) {
      this.resend = new Resend(key);
    } else {
      this.logger.warn(
        'RESEND_API_KEY not set — password-reset emails disabled (dev returns the token instead).',
      );
    }
  }

  get enabled(): boolean {
    return this.resend != null;
  }

  /** Sends the reset email. Never throws; returns whether it was sent. */
  async sendPasswordReset(to: string, token: string): Promise<boolean> {
    if (!this.resend) return false;
    const { subject, html, text } = buildPasswordResetEmail(
      token,
      this.resetUrlBase,
    );
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
        text,
      });
      if (error) {
        this.logger.error(`Resend rejected reset email: ${error.message}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error('Failed to send password-reset email', err as Error);
      return false;
    }
  }
}
