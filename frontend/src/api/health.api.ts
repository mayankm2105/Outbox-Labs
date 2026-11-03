import axios from 'axios';
import { BackendHealth } from '../types/api';

export async function getBackendHealth(): Promise<BackendHealth> {
  // Health check lives at root /health, not /api/v1
  const response = await axios.get<BackendHealth>('/health', {
    withCredentials: true,
  });
  return response.data;
}

