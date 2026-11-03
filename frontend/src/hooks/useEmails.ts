import { useQuery } from '@tanstack/react-query';
import {
  getScheduledEmails,
  getSentEmails,
  getFailedEmails,
} from '../api/emails.api';
import { getCampaignEmails } from '../api/campaigns.api';
import { EmailRecord, PaginatedResult } from '../types/api';

export interface UseEmailsParams {
  variant: 'scheduled' | 'sent' | 'failed' | 'campaign';
  page: number;
  limit: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  campaignId?: string;
}

export function useEmails({
  variant,
  page,
  limit,
  search,
  startDate,
  endDate,
  campaignId,
}: UseEmailsParams) {
  return useQuery<PaginatedResult<EmailRecord>>({
    queryKey: ['emails', variant, page, limit, search, startDate, endDate, campaignId],
    queryFn: async () => {
      if (variant === 'campaign' && campaignId) {
        return getCampaignEmails(campaignId, { page, limit });
      }
      if (variant === 'scheduled') {
        return getScheduledEmails({ page, limit, search, campaignId });
      }
      if (variant === 'sent') {
        return getSentEmails({ page, limit, search, startDate, endDate, campaignId });
      }
      if (variant === 'failed') {
        return getFailedEmails({ page, limit, search, campaignId });
      }
      return { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } };
    },
    refetchInterval: variant === 'scheduled' || variant === 'campaign' ? 5000 : 10000,
    refetchIntervalInBackground: false,
  });
}

