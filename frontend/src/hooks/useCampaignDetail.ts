import { useQuery } from '@tanstack/react-query';
import { getCampaignById } from '../api/campaigns.api';
import { EmailCampaign } from '../types/api';

export function useCampaignDetail(campaignId?: string | null) {
  return useQuery<EmailCampaign>({
    queryKey: ['campaigns', campaignId],
    queryFn: () => getCampaignById(campaignId!),
    enabled: Boolean(campaignId),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
}

