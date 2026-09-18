import { EmailService } from '@/services/email/email.service';
import type { Transporter } from 'nodemailer';

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    emailService = new EmailService('console', 'TripNest <invites@tripnest.local>');
    emailService.clearSentEmails();
  });

  describe('Console Provider', () => {
    it('generates a branded HTML and plaintext invitation and records it in dev buffer', async () => {
      await emailService.sendTripInvitation({
        to: 'bob@example.com',
        inviterName: 'Alice Johnson',
        tripName: 'Goa Holiday 2026',
        destination: 'Goa, India',
        startDate: '2026-10-12T00:00:00.000Z',
        endDate: '2026-10-18T00:00:00.000Z',
        role: 'MEMBER',
        inviteUrl: 'http://localhost:3000/invite?token=secure-test-token-1234',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const sent = emailService.getRecentSentEmails();
      expect(sent).toHaveLength(1);

      const email = sent[0]!;
      expect(email.to).toBe('bob@example.com');
      expect(email.subject).toContain('Alice Johnson invited you to join "Goa Holiday 2026"');
      expect(email.text).toContain('http://localhost:3000/invite?token=secure-test-token-1234');
      expect(email.text).toContain('Alice Johnson');
      expect(email.text).toContain('Goa, India');
      expect(email.html).toContain('TripNest');
      expect(email.html).toContain('Accept Invitation');
      expect(email.html).toContain('Goa Holiday 2026');
    });

    it('generates a branded HTML and plaintext password reset email and records it in dev buffer', async () => {
      await emailService.sendPasswordResetEmail({
        to: 'user@example.com',
        name: 'Jane Doe',
        resetUrl: 'http://localhost:3000/reset-password?token=reset-token-999',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const sent = emailService.getRecentSentEmails();
      expect(sent).toHaveLength(1);

      const email = sent[0]!;
      expect(email.to).toBe('user@example.com');
      expect(email.subject).toBe('Reset your TripNest password');
      expect(email.text).toContain('http://localhost:3000/reset-password?token=reset-token-999');
      expect(email.text).toContain('Jane Doe');
      expect(email.html).toContain('Reset Your Password');
      expect(email.html).toContain('http://localhost:3000/reset-password?token=reset-token-999');
    });

    it('clears sent emails when requested', async () => {
      await emailService.sendTripInvitation({
        to: 'companion@example.com',
        inviterName: 'Meenu',
        tripName: 'Ladakh Road Trip',
        role: 'VIEWER',
        inviteUrl: 'http://localhost:3000/invite?token=token-5678',
        expiresAt: new Date(Date.now() + 86400000),
      });

      expect(emailService.getRecentSentEmails()).toHaveLength(1);
      emailService.clearSentEmails();
      expect(emailService.getRecentSentEmails()).toHaveLength(0);
    });
  });

  describe('SMTP Provider', () => {
    it('dispatches emails via Nodemailer transporter when EMAIL_PROVIDER=smtp', async () => {
      const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'msg-123' });
      const mockTransporter = {
        sendMail: mockSendMail,
      } as unknown as Transporter;

      const smtpService = new EmailService(
        'smtp',
        'TripNest <noreply@tripnest.com>',
        mockTransporter,
      );

      await smtpService.sendPasswordResetEmail({
        to: 'smtpuser@example.com',
        name: 'SMTP User',
        resetUrl: 'http://localhost:3000/reset-password?token=smtp-token',
        expiresAt: new Date(Date.now() + 3600000),
      });

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArg = mockSendMail.mock.calls[0]![0];
      expect(callArg.from).toBe('TripNest <noreply@tripnest.com>');
      expect(callArg.to).toBe('smtpuser@example.com');
      expect(callArg.subject).toBe('Reset your TripNest password');
      expect(callArg.html).toContain('Reset Your Password');
      expect(callArg.text).toContain('http://localhost:3000/reset-password?token=smtp-token');
    });

    it('re-throws error when SMTP transport fails to deliver', async () => {
      const mockSendMail = jest.fn().mockRejectedValue(new Error('SMTP connection refused'));
      const mockTransporter = {
        sendMail: mockSendMail,
      } as unknown as Transporter;

      const smtpService = new EmailService(
        'smtp',
        'TripNest <noreply@tripnest.com>',
        mockTransporter,
      );

      await expect(
        smtpService.sendPasswordResetEmail({
          to: 'fail@example.com',
          name: 'Fail User',
          resetUrl: 'http://localhost:3000/reset-password?token=fail',
          expiresAt: new Date(Date.now() + 3600000),
        }),
      ).rejects.toThrow('SMTP connection refused');
    });

    it('throws error when SMTP provider is enabled without a transporter or SMTP_HOST', async () => {
      const smtpServiceNoHost = new EmailService('smtp', 'TripNest <noreply@tripnest.com>');

      await expect(
        smtpServiceNoHost.sendPasswordResetEmail({
          to: 'nohost@example.com',
          name: 'No Host',
          resetUrl: 'http://localhost:3000/reset-password?token=nohost',
          expiresAt: new Date(Date.now() + 3600000),
        }),
      ).rejects.toThrow('SMTP email delivery failed: SMTP host not configured');
    });
  });
});
