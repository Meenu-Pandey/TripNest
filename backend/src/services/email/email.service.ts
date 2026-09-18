import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';

export interface SendTripInvitationOptions {
  to: string;
  inviterName: string;
  tripName: string;
  destination?: string | null;
  startDate?: string | Date;
  endDate?: string | Date;
  role: string;
  inviteUrl: string;
  expiresAt: string | Date;
}

export interface SendPasswordResetOptions {
  to: string;
  name: string;
  resetUrl: string;
  expiresAt: string | Date;
}

export interface SentEmailRecord {
  to: string;
  subject: string;
  html: string;
  text: string;
  inviteUrl?: string;
  resetUrl?: string;
  sentAt: Date;
}

export interface IEmailService {
  sendTripInvitation(options: SendTripInvitationOptions): Promise<void>;
  sendPasswordResetEmail(options: SendPasswordResetOptions): Promise<void>;
  getRecentSentEmails(): SentEmailRecord[];
  clearSentEmails(): void;
}

export class EmailService implements IEmailService {
  private readonly sentEmails: SentEmailRecord[] = [];
  private transporter: Transporter | null = null;

  constructor(
    private readonly provider = env.EMAIL_PROVIDER,
    private readonly fromAddress = env.EMAIL_FROM,
    customTransporter?: Transporter,
  ) {
    if (customTransporter) {
      this.transporter = customTransporter;
    } else if (this.provider === 'smtp') {
      const host = env.SMTP_HOST;
      const port = env.SMTP_PORT || 587;
      const secure = env.SMTP_SECURE || false;
      const user = env.SMTP_USER;
      const pass = env.SMTP_PASSWORD;

      if (host) {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: user && pass ? { user, pass } : undefined,
        });
      }
    }
  }

  async sendTripInvitation(options: SendTripInvitationOptions): Promise<void> {
    const formattedDates =
      options.startDate && options.endDate
        ? `${new Date(options.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(options.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : 'Dates flexible';

    const formattedExpiry = new Date(options.expiresAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const subject = `${options.inviterName} invited you to join "${options.tripName}" on TripNest`;

    const text = `You've been invited to join a trip on TripNest!

${options.inviterName} invited you to collaborate on "${options.tripName}"${options.destination ? ` in ${options.destination}` : ''} as a ${options.role.toLowerCase()}.

Trip Dates: ${formattedDates}
Role: ${options.role}

To accept your invitation and join the trip workspace, visit the secure link below:
${options.inviteUrl}

This invitation will expire on ${formattedExpiry}.
If you did not expect this invitation, you can safely disregard this email.`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fcfbf9; color: #1c1917; margin: 0; padding: 24px; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e7e5e4; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
    .header { background: #fdfaf7; border-bottom: 1px solid #f3eeea; padding: 28px 32px; text-align: left; }
    .brand { font-size: 20px; font-weight: 700; color: #c25e3e; letter-spacing: -0.5px; margin: 0; display: inline-flex; align-items: center; gap: 8px; }
    .content { padding: 32px; }
    h1 { font-size: 24px; font-weight: 600; color: #1c1917; margin: 0 0 16px 0; line-height: 1.3; }
    p { font-size: 15px; line-height: 1.6; color: #44403c; margin: 0 0 16px 0; }
    .trip-card { background: #fdfaf7; border: 1px solid #eddcd2; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .trip-name { font-size: 18px; font-weight: 600; color: #292524; margin: 0 0 8px 0; }
    .meta-item { font-size: 13px; color: #78716c; margin: 4px 0; }
    .cta-container { text-align: center; margin: 32px 0; }
    .cta-btn { display: inline-block; background-color: #c25e3e; color: #ffffff !important; text-decoration: none; padding: 13px 28px; font-size: 15px; font-weight: 600; border-radius: 10px; }
    .footer { border-top: 1px solid #f3eeea; padding: 20px 32px; font-size: 12px; color: #a8a29e; line-height: 1.5; background: #faf8f5; }
    .link-fallback { word-break: break-all; color: #78716c; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">TripNest</div>
    </div>
    <div class="content">
      <h1>You're invited to travel together</h1>
      <p><strong>${options.inviterName}</strong> has invited you to join and collaborate on a trip workspace in TripNest.</p>

      <div class="trip-card">
        <div class="trip-name">${options.tripName}</div>
        ${options.destination ? `<div class="meta-item">📍 <strong>Destination:</strong> ${options.destination}</div>` : ''}
        <div class="meta-item">🗓️ <strong>Dates:</strong> ${formattedDates}</div>
        <div class="meta-item">👤 <strong>Assigned Role:</strong> ${options.role.toLowerCase()}</div>
      </div>

      <div class="cta-container">
        <a href="${options.inviteUrl}" class="cta-btn" target="_blank" rel="noopener noreferrer">Accept Invitation</a>
      </div>

      <p class="link-fallback">If the button doesn't work, copy and paste this link into your browser:<br><a href="${options.inviteUrl}">${options.inviteUrl}</a></p>
    </div>
    <div class="footer">
      <p>This invitation expires on ${formattedExpiry}. If you weren't expecting this invitation, you can safely ignore this email.</p>
      <p>&copy; ${new Date().getFullYear()} TripNest. Collaborative travel planning.</p>
    </div>
  </div>
</body>
</html>`;

    const record: SentEmailRecord = {
      to: options.to,
      subject,
      html,
      text,
      inviteUrl: options.inviteUrl,
      sentAt: new Date(),
    };

    this.sentEmails.push(record);
    if (this.sentEmails.length > 100) {
      this.sentEmails.shift();
    }

    if (this.provider === 'smtp') {
      if (!this.transporter) {
        logger.error(
          { to: options.to, provider: this.provider },
          'SMTP email delivery failed: SMTP host not configured',
        );
        throw new Error('SMTP email delivery failed: SMTP host not configured');
      }

      try {
        await this.transporter.sendMail({
          from: this.fromAddress,
          to: options.to,
          subject,
          text,
          html,
        });

        logger.info(
          { to: options.to, host: env.SMTP_HOST, from: this.fromAddress, subject },
          'Dispatched invitation email via SMTP',
        );
      } catch (err) {
        logger.error(
          { err, to: options.to, host: env.SMTP_HOST, from: this.fromAddress, subject },
          'Failed to send invitation email via SMTP',
        );
        throw err;
      }
    } else {
      logger.info(
        {
          provider: this.provider,
          to: options.to,
          from: this.fromAddress,
          subject,
          inviteUrl: options.inviteUrl,
        },
        '📨 [TripNest Email Service] Invitation email prepared and recorded',
      );
    }
  }

  async sendPasswordResetEmail(options: SendPasswordResetOptions): Promise<void> {
    const formattedExpiry = new Date(options.expiresAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const subject = `Reset your TripNest password`;

    const text = `Hi ${options.name},

You recently requested to reset your password for your TripNest account.

To set a new password, visit the secure link below:
${options.resetUrl}

This link will expire in 1 hour (around ${formattedExpiry}).
If you did not request a password reset, you can safely ignore this email.`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fcfbf9; color: #1c1917; margin: 0; padding: 24px; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e7e5e4; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
    .header { background: #fdfaf7; border-bottom: 1px solid #f3eeea; padding: 28px 32px; text-align: left; }
    .brand { font-size: 20px; font-weight: 700; color: #c25e3e; letter-spacing: -0.5px; margin: 0; }
    .content { padding: 32px; }
    h1 { font-size: 24px; font-weight: 600; color: #1c1917; margin: 0 0 16px 0; }
    p { font-size: 15px; line-height: 1.6; color: #44403c; margin: 0 0 16px 0; }
    .cta-container { text-align: center; margin: 32px 0; }
    .cta-btn { display: inline-block; background-color: #c25e3e; color: #ffffff !important; text-decoration: none; padding: 13px 28px; font-size: 15px; font-weight: 600; border-radius: 10px; }
    .footer { border-top: 1px solid #f3eeea; padding: 20px 32px; font-size: 12px; color: #a8a29e; line-height: 1.5; background: #faf8f5; }
    .link-fallback { word-break: break-all; color: #78716c; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">TripNest</div>
    </div>
    <div class="content">
      <h1>Reset Your Password</h1>
      <p>Hi <strong>${options.name}</strong>,</p>
      <p>You requested to reset your password for your TripNest account. Click the button below to choose a new password:</p>

      <div class="cta-container">
        <a href="${options.resetUrl}" class="cta-btn" target="_blank" rel="noopener noreferrer">Reset Password</a>
      </div>

      <p class="link-fallback">If the button doesn't work, copy and paste this link into your browser:<br><a href="${options.resetUrl}">${options.resetUrl}</a></p>
    </div>
    <div class="footer">
      <p>If you didn't request a password reset, you can safely ignore this email.</p>
      <p>&copy; ${new Date().getFullYear()} TripNest. Collaborative travel planning.</p>
    </div>
  </div>
</body>
</html>`;

    const record: SentEmailRecord = {
      to: options.to,
      subject,
      html,
      text,
      resetUrl: options.resetUrl,
      sentAt: new Date(),
    };

    this.sentEmails.push(record);
    if (this.sentEmails.length > 100) {
      this.sentEmails.shift();
    }

    if (this.provider === 'smtp') {
      if (!this.transporter) {
        logger.error(
          { to: options.to, provider: this.provider },
          'SMTP email delivery failed: SMTP host not configured',
        );
        throw new Error('SMTP email delivery failed: SMTP host not configured');
      }

      try {
        await this.transporter.sendMail({
          from: this.fromAddress,
          to: options.to,
          subject,
          text,
          html,
        });

        logger.info(
          { to: options.to, host: env.SMTP_HOST, from: this.fromAddress, subject },
          'Dispatched password reset email via SMTP',
        );
      } catch (err) {
        logger.error(
          { err, to: options.to, host: env.SMTP_HOST, from: this.fromAddress, subject },
          'Failed to send password reset email via SMTP',
        );
        throw err;
      }
    } else {
      logger.info(
        {
          provider: this.provider,
          to: options.to,
          from: this.fromAddress,
          subject,
          resetUrl: options.resetUrl,
        },
        '📨 [TripNest Email Service] Password reset email prepared and recorded',
      );
    }
  }

  getRecentSentEmails(): SentEmailRecord[] {
    return [...this.sentEmails];
  }

  clearSentEmails(): void {
    this.sentEmails.length = 0;
  }
}

export const emailService = new EmailService();
