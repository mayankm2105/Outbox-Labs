import { z } from 'zod';

export const createSenderSchema = z.object({
  email: z.string().trim().email('Invalid sender email'),
  displayName: z.string().trim().optional(),
  smtpHost: z.string().trim().min(1, 'smtpHost is required'),
  smtpPort: z.coerce.number().int().positive('smtpPort must be positive'),
  smtpUsername: z.string().trim().min(1, 'smtpUsername is required'),
  smtpPassword: z.string().min(1, 'smtpPassword is required'),
});

export type CreateSenderInput = z.infer<typeof createSenderSchema>;

