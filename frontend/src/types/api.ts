export type CampaignStatus =
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PARTIALLY_COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type EmailStatus =
  | 'CREATED'
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'RETRY_SCHEDULED'
  | 'SENT'
  | 'DELIVERY_UNKNOWN'
  | 'FAILED'
  | 'CANCELLED';

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: Pagination;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  avatarUrl?: string | null;
}

export interface SenderAccount {
  id: string;
  userId: string;
  email: string;
  displayName?: string | null;
  smtpHost: string;
  smtpPort: number;
  isActive: boolean;
  createdAt: string;
}

export interface CampaignStats {
  total: number;
  SCHEDULED: number;
  PROCESSING: number;
  SENT: number;
  FAILED: number;
  CANCELLED: number;
  RETRY_SCHEDULED: number;
  DELIVERY_UNKNOWN: number;
}

export interface EmailCampaign {
  id: string;
  subject: string;
  body: string;
  startAt: string;
  delaySeconds: number;
  hourlyLimit: number;
  totalRecipients: number;
  status: CampaignStatus;
  createdAt: string;
  updatedAt?: string;
  senderAccount?: {
    id: string;
    email: string;
    displayName?: string | null;
  };
  stats?: CampaignStats;
}

export interface EmailRecord {
  id: string;
  campaignId: string;
  recipientEmail: string;
  subject: string;
  body?: string;
  scheduledAt?: string;
  sentAt?: string | null;
  status: EmailStatus;
  retryCount?: number;
  sequenceNumber?: number;
  providerMessageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt?: string;
  campaign?: {
    id: string;
    subject: string;
    status: CampaignStatus;
  };
  senderAccount?: {
    email: string;
    displayName?: string | null;
  };
  events?: EmailEvent[];
}

export interface EmailEvent {
  id: string;
  eventType: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ScheduleCampaignPayload {
  senderAccountId: string;
  subject: string;
  body: string;
  recipients: string[];
  startAt: string;
  delaySeconds: number;
  hourlyLimit: number;
}

export interface ScheduleCampaignResponse {
  campaignId: string;
  totalRecipients: number;
  deduplicatedCount: number;
  status: CampaignStatus;
  scheduledCount: number;
}

export interface SlackStatus {
  connected: boolean;
  workspaceName?: string;
}

export interface BackendHealth {
  status: string;
  timestamp: string;
  postgres: 'ok' | string;
  redis: 'ok' | string;
  elasticsearch: 'ok' | string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface ApiErrorDetail {
  path?: string;
  message: string;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  error: {
    code: string;
    details: ApiErrorDetail[];
  };
}

export class ApiError extends Error {
  status: number;
  code: string;
  details: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

