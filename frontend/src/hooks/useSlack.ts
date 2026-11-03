import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSlackStatus,
  sendSlackTestNotification,
  disconnectSlack,
} from '../api/integrations.api';
import { SlackStatus } from '../types/api';
import { useToast } from '../context/ToastContext';

export function useSlack() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const query = useQuery<SlackStatus>({
    queryKey: ['slack', 'status'],
    queryFn: getSlackStatus,
    refetchInterval: 15000,
    retry: false,
  });

  const testMutation = useMutation({
    mutationFn: sendSlackTestNotification,
    onSuccess: (data) => {
      toast.success(data.message || 'Test notification sent to Slack!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to send test Slack notification.');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectSlack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack', 'status'] });
      toast.info('Slack integration disconnected.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to disconnect Slack.');
    },
  });

  return {
    ...query,
    slackStatus: query.data,
    sendTestNotification: testMutation.mutateAsync,
    isTesting: testMutation.isPending,
    disconnect: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
  };
}

