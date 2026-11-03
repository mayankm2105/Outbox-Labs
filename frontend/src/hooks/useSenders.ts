import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSenders, createSender, CreateSenderPayload } from '../api/senders.api';
import { SenderAccount } from '../types/api';
import { useToast } from '../context/ToastContext';

export function useSenders() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const query = useQuery<SenderAccount[]>({
    queryKey: ['senders'],
    queryFn: getSenders,
  });

  const createSenderMutation = useMutation({
    mutationFn: (payload: CreateSenderPayload) => createSender(payload),
    onSuccess: (newSender) => {
      queryClient.invalidateQueries({ queryKey: ['senders'] });
      toast.success(`Sender "${newSender.email}" created successfully.`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create sender account.');
    },
  });

  return {
    ...query,
    senders: query.data || [],
    createSender: createSenderMutation.mutateAsync,
    isCreating: createSenderMutation.isPending,
  };
}

