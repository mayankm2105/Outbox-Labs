import axios, { AxiosError } from 'axios';
import { ApiEnvelope, ApiError, ApiErrorBody } from '../types/api';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

if (import.meta.env.VITE_DEV_USER_ID) {
  apiClient.defaults.headers.common['x-user-id'] = import.meta.env.VITE_DEV_USER_ID;
}

apiClient.interceptors.response.use(
  (response) => {
    // If response is standard envelope, unwrap .data.data
    const body = response.data as ApiEnvelope<unknown>;
    if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
      return body.data as any;
    }
    return response.data;
  },
  (error: AxiosError<ApiErrorBody>) => {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      // Handle 401 unauthorized
      if (status === 401 && !error.config?.url?.includes('/auth/me')) {
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }

      if (data && data.error) {
        return Promise.reject(
          new ApiError(status, data.error.code || 'API_ERROR', data.message || 'Request failed', data.error.details || []),
        );
      }

      return Promise.reject(
        new ApiError(status, 'HTTP_ERROR', data?.message || error.message || 'Request failed', []),
      );
    }

    // Network / timeout error
    return Promise.reject(
      new ApiError(0, 'NETWORK_ERROR', error.message || 'Network error occurred', []),
    );
  },
);

