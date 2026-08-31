import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type { ApiEnvelope } from '@/types';
import { forceLogout, tokens } from './tokens';

/** Thrown for any non-2xx response, carrying the API's own message. */
export class ApiError extends Error {
  status: number;
  details?: { field: string; message: string }[];

  constructor(message: string, status: number, details?: { field: string; message: string }[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

class ApiClient {
  private instance: AxiosInstance;

  /** Single in-flight refresh shared by every request that 401s at once. */
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.instance = axios.create({
      baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
      headers: { 'Content-Type': 'application/json' },
    });

    this.instance.interceptors.request.use((config) => {
      const token = tokens.access('door');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    this.instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const status = error.response?.status ?? 0;
        const payload = error.response?.data;
        const original = error.config as AxiosRequestConfig & { _retried?: boolean };

        // One refresh attempt per request; a second failure ends the session.
        const isRefreshCall = original?.url?.includes('/auth/refresh');
        if (status === 401 && original && !original._retried && !isRefreshCall && tokens.refresh('door')) {
          original._retried = true;
          try {
            const fresh = await this.refreshAccessToken();
            original.headers = { ...original.headers, Authorization: `Bearer ${fresh}` };
            return this.instance.request(original);
          } catch {
            forceLogout('Your session expired');
            throw new ApiError('Your session expired — please sign in again', 401);
          }
        }

        if (status === 401 && !isRefreshCall) {
          forceLogout('Your session expired');
        }

        return Promise.reject(
          new ApiError(
            payload?.message ?? error.message ?? 'Something went wrong',
            status,
            payload?.details,
          ),
        );
      },
    );
  }

  private refreshAccessToken(): Promise<string> {
    if (this.refreshPromise) return this.refreshPromise;

    const refreshToken = tokens.refresh('door');
    if (!refreshToken) return Promise.reject(new Error('No door refresh token'));

    this.refreshPromise = this.instance
      .post<ApiEnvelope<{ accessToken: string; refreshToken: string }>>('/auth/refresh', {
        refreshToken,
      })
      .then(({ data }) => {
        tokens.set('door', data.data.accessToken, data.data.refreshToken);
        return data.data.accessToken;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  /** Unwraps the API's { success, message, data, meta } envelope. */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiEnvelope<T>> {
    const { data } = await this.instance.get<ApiEnvelope<T>>(url, config);
    return data;
  }

  async post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<ApiEnvelope<T>> {
    const { data } = await this.instance.post<ApiEnvelope<T>>(url, body, config);
    return data;
  }

  async patch<T>(url: string, body?: unknown): Promise<ApiEnvelope<T>> {
    const { data } = await this.instance.patch<ApiEnvelope<T>>(url, body);
    return data;
  }

  async delete<T>(url: string): Promise<ApiEnvelope<T>> {
    const { data } = await this.instance.delete<ApiEnvelope<T>>(url);
    return data;
  }
}

export const api = new ApiClient();
export default api;
