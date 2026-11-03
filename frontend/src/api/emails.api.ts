import { apiClient } from './client';
import {
  EmailRecord,
  PaginatedResult,
  ScheduleCampaignPayload,
  ScheduleCampaignResponse,
} from '../types/api';

export async function scheduleEmail(
  payload: ScheduleCampaignPayload,
  idempotencyKey: string,
): Promise<ScheduleCampaignResponse> {
  return apiClient.post<unknown, ScheduleCampaignResponse>('/emails/schedule', payload, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
}

export async function getScheduledEmails(params: {
  page?: number;
  limit?: number;
  search?: string;
  campaignId?: string;
}): Promise<PaginatedResult<EmailRecord>> {
  return apiClient.get<unknown, PaginatedResult<EmailRecord>>('/emails/scheduled', { params });
}

export async function getSentEmails(params: {
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  campaignId?: string;
}): Promise<PaginatedResult<EmailRecord>> {
  return apiClient.get<unknown, PaginatedResult<EmailRecord>>('/emails/sent', { params });
}

export async function getFailedEmails(params: {
  page?: number;
  limit?: number;
  search?: string;
  campaignId?: string;
}): Promise<PaginatedResult<EmailRecord>> {
  return apiClient.get<unknown, PaginatedResult<EmailRecord>>('/emails/failed', { params });
}

export async function getEmailById(id: string): Promise<EmailRecord> {
  return apiClient.get<unknown, EmailRecord>(`/emails/${id}`);
}

