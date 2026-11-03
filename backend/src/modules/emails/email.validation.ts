import { z } from 'zod';
import { EmailStatus } from '@prisma/client';

export const listEmailsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  search: z.string().trim().optional(),
  campaignId: z.string().uuid().optional(),
  status: z.nativeEnum(EmailStatus).optional(),
  sortBy: z.enum(['scheduledAt', 'createdAt', 'sentAt']).default('scheduledAt').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc').optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type ListEmailsQuery = z.infer<typeof listEmailsQuerySchema>;

export const campaignIdParamSchema = z.object({
  id: z.string().uuid('Invalid campaign ID format'),
});

export const emailIdParamSchema = z.object({
  id: z.string().uuid('Invalid email ID format'),
});

