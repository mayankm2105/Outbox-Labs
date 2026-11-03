import { describe, it, expect } from 'vitest';
import { classifySmtpError } from '../../src/shared/utils/smtp-error-classifier';

describe('SMTP Error Classifier', () => {
  it('classifies network timeouts and connection resets as transient', () => {
    const timeoutErr = { code: 'ETIMEDOUT', message: 'Connection timed out' };
    const resetErr = { code: 'ECONNRESET', message: 'Connection reset by peer' };
    const socketErr = { code: 'ESOCKETTIMEDOUT', message: 'Socket timeout' };

    expect(classifySmtpError(timeoutErr).isTransient).toBe(true);
    expect(classifySmtpError(resetErr).isTransient).toBe(true);
    expect(classifySmtpError(socketErr).isTransient).toBe(true);
  });

  it('classifies 4xx SMTP temporary error codes as transient', () => {
    const smtp421 = { responseCode: 421, message: 'Service not available, closing channel' };
    const smtp450 = { responseCode: 450, message: 'Mailbox busy' };
    const smtp451 = { responseCode: 451, message: 'Local error in processing' };

    const c421 = classifySmtpError(smtp421);
    expect(c421.isTransient).toBe(true);
    expect(c421.errorCode).toBe('SMTP_421');

    const c450 = classifySmtpError(smtp450);
    expect(c450.isTransient).toBe(true);
    expect(c450.errorCode).toBe('SMTP_450');
  });

  it('classifies 5xx SMTP permanent error codes as non-transient', () => {
    const smtp550 = { responseCode: 550, message: '5.1.1 User unknown' };
    const smtp554 = { responseCode: 554, message: 'Transaction failed' };

    const c550 = classifySmtpError(smtp550);
    expect(c550.isTransient).toBe(false);
    expect(c550.errorCode).toBe('SMTP_550');

    const c554 = classifySmtpError(smtp554);
    expect(c554.isTransient).toBe(false);
    expect(c554.errorCode).toBe('SMTP_554');
  });

  it('classifies authentication errors (EAUTH) as non-transient', () => {
    const authErr = { code: 'EAUTH', message: 'Invalid login: 535-5.7.8 Username and Password not accepted' };
    const c = classifySmtpError(authErr);

    expect(c.isTransient).toBe(false);
    expect(c.errorCode).toBe('SMTP_AUTH_FAILED');
  });

  it('classifies string timeout in message as transient', () => {
    const err = { message: 'Greeting failed: Connection timeout after 30000ms' };
    const c = classifySmtpError(err);

    expect(c.isTransient).toBe(true);
    expect(c.errorCode).toBe('SMTP_TIMEOUT');
  });
});

