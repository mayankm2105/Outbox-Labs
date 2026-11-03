import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCampaigns,
  cancelCampaign,
} from '../api/campaigns.api';
import { scheduleEmail } from '../api/emails.api';
import {
  EmailCampaign,
  PaginatedResult,
  ScheduleCampaignPayload,
} from '../types/api';
import { useToast } from '../context/ToastContext';

export function useCampaigns(params: { page: number; limit: number } = { page: 1, limit: 10 }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const query = useQuery<PaginatedResult<EmailCampaign>>({
    queryKey: ['campaigns', params.page, params.limit],
    queryFn: () => getCampaigns(params),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });

  const scheduleMutation = useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: ScheduleCampaignPayload;
      idempotencyKey: string;
    }) => scheduleEmail(payload, idempotencyKey),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['emails', 'scheduled'] });
      toast.success(
        `Campaign scheduled — ${data.scheduledCount} email(s) queued.`,
        'Campaign Created',
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (campaignId: string) => cancelCampaign(campaignId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns', res.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['emails', 'scheduled'] });
      toast.info(`Campaign cancelled. ${res.cancelledCount} pending email(s) stopped.`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to cancel campaign.');
    },
  });

  return {
    ...query,
    campaigns: query.data?.items || [],
    pagination: query.data?.pagination,
    scheduleCampaign: scheduleMutation.mutateAsync,
    isScheduling: scheduleMutation.isPending,
    cancelCampaign: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
  };
}

