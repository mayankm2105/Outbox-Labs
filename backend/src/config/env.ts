import { z } from 'zod';

/**
 * Environment variable schema.
 * Validated once at startup — the process exits immediately if any required
 * variable is missing or malformed.
 */
const envSchema = z.object({
  // ── Server ──────────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  FRONTEND_URL: z.string().url(),
  API_BASE_URL: z.string().url(),

  // ── Database ─────────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // ── Redis ────────────────────────────────────────────────────────────────────
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // ── Session ──────────────────────────────────────────────────────────────────
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(86400),

  // ── Google OAuth ─────────────────────────────────────────────────────────────
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_CALLBACK_URL: z.string().url(),

  // ── Ethereal SMTP ────────────────────────────────────────────────────────────
  ETHEREAL_HOST: z.string().default('smtp.ethereal.email'),
  ETHEREAL_PORT: z.coerce.number().int().positive().default(587),
  ETHEREAL_USER: z.string().min(1, 'ETHEREAL_USER is required'),
  ETHEREAL_PASSWORD: z.string().min(1, 'ETHEREAL_PASSWORD is required'),

  // ── Elasticsearch ────────────────────────────────────────────────────────────
  ELASTICSEARCH_URL: z.string().url().default('http://localhost:9200'),

  // ── Slack ────────────────────────────────────────────────────────────────────
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_REDIRECT_URI: z.string().url().optional(),

  // ── Worker Concurrency ───────────────────────────────────────────────────────
  EMAIL_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  NOTIFICATION_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),

  // ── Retry ────────────────────────────────────────────────────────────────────
  EMAIL_MAX_RETRIES: z.coerce.number().int().min(1).max(10).default(5),
  EMAIL_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(5000),

  // ── Rate Limiting ────────────────────────────────────────────────────────────
  GLOBAL_HOURLY_LIMIT: z.coerce.number().int().positive().default(100),
  DEFAULT_EMAIL_DELAY_SECONDS: z.coerce.number().int().min(0).default(60),

  // ── Campaign Limits ──────────────────────────────────────────────────────────
  MAX_RECIPIENTS_PER_CAMPAIGN: z.coerce.number().int().positive().default(500),

  // ── Outbox & Reconciliation ──────────────────────────────────────────────────
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  RECONCILIATION_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(60000),

  // ── Encryption ───────────────────────────────────────────────────────────────
  // 64-character hex string (32 bytes for AES-256-GCM)
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be a 64-character hex string'),

  // ── Logging ──────────────────────────────────────────────────────────────────
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error('❌  Environment validation failed:\n' + formatted);
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();

