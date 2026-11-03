import { apiClient } from './client';
import { EmailCampaign, EmailRecord, PaginatedResult } from '../types/api';

export async function getCampaigns(params: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<EmailCampaign>> {
  return apiClient.get<unknown, PaginatedResult<EmailCampaign>>('/campaigns', { params });
}

export async function getCampaignById(id: string): Promise<EmailCampaign> {
  return apiClient.get<unknown, EmailCampaign>(`/campaigns/${id}`);
}

export async function getCampaignEmails(
  id: string,
  params: { page?: number; limit?: number },
): Promise<PaginatedResult<EmailRecord>> {
  return apiClient.get<unknown, PaginatedResult<EmailRecord>>(`/campaigns/${id}/emails`, {
    params,
  });
}

export async function cancelCampaign(
  id: string,
): Promise<{ campaignId: string; cancelledCount: number; status: string }> {
  return apiClient.post<unknown, { campaignId: string; cancelledCount: number; status: string }>(
    `/campaigns/${id}/cancel`,
  );
}

