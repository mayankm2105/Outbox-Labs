import { z } from 'zod';
import { env } from '../../config/env';
import { ApiError } from '../../shared/errors/api-error';

export const scheduleEmailSchema = z.object({
  senderAccountId: z.string().uuid('Invalid senderAccountId UUID'),
  subject: z.string().trim().min(1, 'Subject cannot be empty').max(998, 'Subject exceeds 998 characters'),
  body: z.string().trim().min(1, 'Body cannot be empty'),
  recipients: z
    .array(z.string().trim().email('Invalid recipient email address'))
    .min(1, 'At least one recipient is required')
    .max(
      env.MAX_RECIPIENTS_PER_CAMPAIGN,
      `Exceeded maximum recipients limit of ${env.MAX_RECIPIENTS_PER_CAMPAIGN}`,
    ),
  startAt: z.string().datetime({ message: 'startAt must be a valid ISO 8601 timestamp' }),
  delaySeconds: z.coerce.number().int().min(0, 'delaySeconds must be non-negative').default(0),
  hourlyLimit: z.coerce.number().int().positive('hourlyLimit must be a positive integer').max(10000),
});

export type ScheduleEmailInput = z.infer<typeof scheduleEmailSchema>;

export interface ProcessedStartAt {
  effectiveStartAt: Date;
  isImmediate: boolean;
}

/**
 * Validates startAt with a 60-second grace window against server time.
 * - If startAt < currentServerTime - 60s: throws ApiError(400, 'START_TIME_IN_PAST')
 * - If startAt is in the past but >= currentServerTime - 60s: returns currentServerTime (immediate)
 * - If startAt is in the future: returns startAt as-is
 */
export function validateAndProcessStartAt(
  startAtIso: string,
  currentServerTime: Date = new Date(),
): ProcessedStartAt {
  const requestedDate = new Date(startAtIso);
  if (isNaN(requestedDate.getTime())) {
    throw ApiError.badRequest('Invalid ISO 8601 date string', 'INVALID_DATE');
  }

  const graceWindowMs = 60 * 1000;
  const cutoffTime = currentServerTime.getTime() - graceWindowMs;

  if (requestedDate.getTime() < cutoffTime) {
    throw new ApiError(
      400,
      'START_TIME_IN_PAST',
      'Start time must be in the future or within the allowed 60-second grace window.',
    );
  }

  // If in the past but within the grace window, schedule immediately (server time)
  if (requestedDate.getTime() < currentServerTime.getTime()) {
    return {
      effectiveStartAt: new Date(currentServerTime.getTime()),
      isImmediate: true,
    };
  }

  // Future timestamp
  return {
    effectiveStartAt: requestedDate,
    isImmediate: false,
  };
}

/**
 * Deduplicates recipient email addresses preserving the first occurrence.
 * Returns unique array and count of duplicates removed.
 */
export function deduplicateRecipients(recipients: string[]): {
  uniqueRecipients: string[];
  deduplicatedCount: number;
} {
  const seen = new Set<string>();
  const uniqueRecipients: string[] = [];

  for (const email of recipients) {
    const normalized = email.toLowerCase().trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueRecipients.push(email.trim());
    }
  }

  const deduplicatedCount = recipients.length - uniqueRecipients.length;
  return { uniqueRecipients, deduplicatedCount };
}

