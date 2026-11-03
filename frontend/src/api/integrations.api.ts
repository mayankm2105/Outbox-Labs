import { apiClient } from './client';
import { SlackStatus } from '../types/api';

export async function getSlackStatus(): Promise<SlackStatus> {
  return apiClient.get<unknown, SlackStatus>('/integrations/slack/status');
}

export async function sendSlackTestNotification(): Promise<{ message: string }> {
  return apiClient.post<unknown, { message: string }>('/integrations/slack/test');
}

export async function disconnectSlack(): Promise<{ message: string }> {
  return apiClient.delete<unknown, { message: string }>('/integrations/slack');
}

