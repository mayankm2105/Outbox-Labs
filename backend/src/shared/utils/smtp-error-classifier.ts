export interface ClassifiedSmtpError {
  isTransient: boolean;
  errorCode: string;
  message: string;
}

const TRANSIENT_NODE_ERRORS = [
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ESOCKETTIMEDOUT',
  'EPIPE',
];

export function classifySmtpError(err: any): ClassifiedSmtpError {
  if (!err) {
    return {
      isTransient: false,
      errorCode: 'UNKNOWN_ERROR',
      message: 'Unknown error occurred',
    };
  }

  const code = String(err.code || err.errno || '').toUpperCase();
  const responseCode = Number(err.responseCode);
  const message = err.message || 'SMTP error';

  // Check Node.js socket / network errors
  if (TRANSIENT_NODE_ERRORS.includes(code)) {
    return {
      isTransient: true,
      errorCode: code,
      message,
    };
  }

  // Check SMTP response codes
  if (responseCode >= 400 && responseCode < 500) {
    return {
      isTransient: true,
      errorCode: `SMTP_${responseCode}`,
      message,
    };
  }

  if (responseCode >= 500 && responseCode < 600) {
    return {
      isTransient: false,
      errorCode: `SMTP_${responseCode}`,
      message,
    };
  }

  // Auth failure is permanent until credentials change
  if (code === 'EAUTH') {
    return {
      isTransient: false,
      errorCode: 'SMTP_AUTH_FAILED',
      message: 'SMTP authentication failed; check credentials',
    };
  }

  // Timeout in message
  if (/timeout/i.test(message)) {
    return {
      isTransient: true,
      errorCode: 'SMTP_TIMEOUT',
      message,
    };
  }

  // Default to non-transient for other unexpected errors
  return {
    isTransient: false,
    errorCode: code || 'SMTP_FAILED',
    message,
  };
}

