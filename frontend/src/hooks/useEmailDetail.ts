import { useQuery } from '@tanstack/react-query';
import { getEmailById } from '../api/emails.api';
import { EmailRecord } from '../types/api';

export function useEmailDetail(emailId?: string | null) {
  return useQuery<EmailRecord>({
    queryKey: ['emails', 'detail', emailId],
    queryFn: () => getEmailById(emailId!),
    enabled: Boolean(emailId),
  });
}

