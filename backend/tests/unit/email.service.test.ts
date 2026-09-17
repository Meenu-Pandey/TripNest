import { EmailService } from '@/services/email/email.service';

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    emailService = new EmailService('console', 'invites@tripnest.local');
    emailService.clearSentEmails();
  });

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
