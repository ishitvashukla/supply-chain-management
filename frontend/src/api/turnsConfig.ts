/**
 * Turns is reached through our own API rather than directly.
 *
 * Turns only returns CORS headers for allowlisted origins, and a deployed
 * origin is not one of them. Relaying through the backend removes the CORS
 * problem entirely and means dev and production behave identically — the old
 * dev-only vite proxy had no production equivalent.
 */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';

/** `{BUSINESS_ID}` is resolved server-side; the client only sends the id. */
export const turnsBaseUrl = (businessId: string): string =>
  `${API_BASE.replace(/\/+$/, '')}/turns/${encodeURIComponent(businessId)}/`;

export const TURNS_PLATFORM = 'CUSTOMER_APP';

/**
 * The turns API rejects any request that omits these with
 * 401 "You are passing an invalid value for app name" — regardless of whether
 * the bearer token is valid. They are app identity, not authentication.
 * The relay sets them too; these keep direct calls working if that changes.
 */
export const TURNS_APP_HEADERS: Record<string, string> = {
  'X-App-Name': (import.meta.env.VITE_TURNS_APP_NAME as string) ?? '1.0.0.0',
  'X-App-Version': (import.meta.env.VITE_TURNS_APP_VERSION as string) ?? '10000',
  'Os-Version': (import.meta.env.VITE_TURNS_OS_VERSION as string) ?? '24',
};
