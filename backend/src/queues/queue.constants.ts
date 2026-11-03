export const QUEUE_NAMES = {
  EMAIL_SCHEDULING: 'email-scheduling',
  EMAIL_SENDING: 'email-sending',
  NOTIFICATION: 'notification',
  EMAIL_RECONCILIATION: 'email-reconciliation',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

