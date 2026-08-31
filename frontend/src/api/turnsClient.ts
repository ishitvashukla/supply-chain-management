import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import dayjs from 'dayjs';
import { ApiError } from './client';
import { forceLogout, session, tokens } from './tokens';
import { TURNS_APP_HEADERS, TURNS_PLATFORM, turnsBaseUrl } from './turnsConfig';
import { TURNS } from './turnsEndpoints';

export interface TurnsEnvelope<T> {
  status: boolean;
  message?: string;
  data: T;
}

/**
 * Client for the turns backend.
 *
 * No HMAC signing: that is only required for the ADMIN platform. We identify
 * as CUSTOMER_APP, which the backend accepts unsigned.
 */
class TurnsClient {
  private instance: AxiosInstance;

  /** Single in-flight refresh, shared by every request that 401s at once. */
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.instance = axios.create({ headers: { 'Content-Type': 'application/json' } });

    this.instance.interceptors.request.use((config) => {
      const businessId = session.businessId();
      if (!businessId) throw new ApiError('No business selected', 400);

      config.baseURL = turnsBaseUrl(businessId);
      config.headers['X-Platform'] = TURNS_PLATFORM;
      config.headers['X-Date'] = dayjs().format('YYYY-MM-DD');
      Object.entries(TURNS_APP_HEADERS).forEach(([key, value]) => {
        config.headers[key] = value;
      });

      const userId = session.userId();
      if (userId) config.headers['X-User-ID'] = userId;

      // The refresh call sets its own Authorization to the refresh token.
      if (!config.headers.Authorization) {
        const token = tokens.access('turns');
        if (token) config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    });

    this.instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const status = error.response?.status ?? 0;
        const original = error.config as AxiosRequestConfig & { _retried?: boolean };

        // One refresh attempt per request; a second failure signs the user out.
        if (status === 401 && original && !original._retried && tokens.refresh('turns')) {
          original._retried = true;
          try {
            const fresh = await this.refreshAccessToken();
            original.headers = { ...original.headers, Authorization: `Bearer ${fresh}` };
            return this.instance.request(original);
          } catch {
            forceLogout('Your turns session expired');
            throw new ApiError('Your turns session expired — please sign in again', 401);
          }
        }

        if (status === 401) {
          forceLogout('Your turns session expired');
        }

        throw new ApiError(
          error.response?.data?.message ?? error.message ?? 'Turns request failed',
          status,
        );
      },
    );
  }

  private refreshAccessToken(): Promise<string> {
    if (this.refreshPromise) return this.refreshPromise;

    const refreshToken = tokens.refresh('turns');
    if (!refreshToken) return Promise.reject(new Error('No turns refresh token'));

    this.refreshPromise = this.instance
      .get<TurnsEnvelope<{ access_token: string }>>(TURNS.UPDATE_TOKEN, {
        headers: { Authorization: `Bearer ${refreshToken}` },
      })
      .then(({ data }) => {
        if (!data.status || !data.data?.access_token) throw new Error('Turns refresh rejected');
        tokens.setAccess('turns', data.data.access_token);
        return data.data.access_token;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<TurnsEnvelope<T>> {
    const { data } = await this.instance.get<TurnsEnvelope<T>>(url, config);
    return data;
  }

  async post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<TurnsEnvelope<T>> {
    const { data } = await this.instance.post<TurnsEnvelope<T>>(url, body, config);
    return data;
  }
}

export const turnsApi = new TurnsClient();
export default turnsApi;
