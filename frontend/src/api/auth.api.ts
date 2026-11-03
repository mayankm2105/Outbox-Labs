import { apiClient } from './client';
import { User } from '../types/api';

export async function getCurrentUser(): Promise<User> {
  return apiClient.get<unknown, User>('/auth/me');
}

export async function logout(): Promise<{ message: string }> {
  return apiClient.post<unknown, { message: string }>('/auth/logout');
}

