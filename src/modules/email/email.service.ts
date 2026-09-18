import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { buildPasswordResetEmail } from './email.templates';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend?: Resend;
  private readonly from: string;
  private readonly resetUrlBase: string;

  constructor(configService: ConfigService) {
    const key = configService.get<string>('RESEND_API_KEY');
    this.from =
      configService.get<string>('RESEND_FROM') ??
      'Apsara Wallet <onboarding@resend.dev>';

    this.resetUrlBase =
      configService.get<string>('PASSWORD_RESET_URL') ??
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
