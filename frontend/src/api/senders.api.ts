import { apiClient } from './client';
import { SenderAccount } from '../types/api';

export interface CreateSenderPayload {
  email: string;
  displayName?: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
}

export async function getSenders(): Promise<SenderAccount[]> {
  return apiClient.get<unknown, SenderAccount[]>('/senders');
}

export async function createSender(payload: CreateSenderPayload): Promise<SenderAccount> {
  return apiClient.post<unknown, SenderAccount>('/senders', payload);
}

