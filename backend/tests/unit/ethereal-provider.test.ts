import { describe, it, expect, vi } from 'vitest';
import { EtherealEmailProvider } from '../../src/providers/email/ethereal.provider';

describe('EtherealEmailProvider', () => {
  it('sends email using transporter and returns messageId and previewUrl', async () => {
    const mockTransporter = {
      sendMail: vi.fn().mockResolvedValue({
        messageId: '<test-message-123@ethereal.email>',
      }),
    };

    const provider = new EtherealEmailProvider(mockTransporter as any);

    const result = await provider.sendEmail({
      from: '"Sender" <sender@test.com>',
      to: 'recipient@test.com',
      subject: 'Test Subject',
      body: 'Hello World Body',
    });

    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Sender" <sender@test.com>',
        to: 'recipient@test.com',
        subject: 'Test Subject',
        text: 'Hello World Body',
      }),
    );

    expect(result.messageId).toBe('<test-message-123@ethereal.email>');
  });

  it('propagates transporter errors', async () => {
    const mockTransporter = {
      sendMail: vi.fn().mockRejectedValue(new Error('SMTP connection failed')),
    };

    const provider = new EtherealEmailProvider(mockTransporter as any);

    await expect(
      provider.sendEmail({
        from: 'from@test.com',
        to: 'to@test.com',
        subject: 'Subject',
        body: 'Body',
      }),
    ).rejects.toThrow('SMTP connection failed');
  });
});

