/**
 * The turns backend is multi-tenant: the business id is part of the host, so
 * the base URL is a template resolved per request once the user has picked a
 * business.
 */
const PROD_BASE = import.meta.env.VITE_TURNS_BASE_URL as string | undefined;
const DEV_BASE = import.meta.env.VITE_TURNS_DEV_BASE_URL as string | undefined;
const BUILD = (import.meta.env.VITE_TURNS_BUILD as string | undefined) ?? 'prod';

/** Same-origin path the vite dev server proxies to the turns backend. */
export const TURNS_DEV_PROXY_PREFIX = '/__turns_api';

const isLocalhost = (): boolean =>
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

export const turnsTemplate = (): string => {
  const base = BUILD === 'dev' ? DEV_BASE : PROD_BASE;
  if (!base) {
    throw new Error(
      'Missing VITE_TURNS_BASE_URL / VITE_TURNS_DEV_BASE_URL — set them in frontend/.env',
    );
  }
  return base;
};

/**
 * Resolve the base URL for a business id.
 *
 * On localhost the turns backend does not return CORS headers for our origin,
 * so requests go through the dev server's same-origin proxy, which forwards
 * them server-side where no CORS check applies. The target host is encoded in
 * the path because it varies per tenant and per build.
 */
export const turnsBaseUrl = (businessId: string): string => {
  const resolved = turnsTemplate().replace('{BUSINESS_ID}', businessId);

  if (import.meta.env.DEV && isLocalhost()) {
    const url = new URL(resolved);
    return `${TURNS_DEV_PROXY_PREFIX}/${url.host}${url.pathname}`.replace(/\/+$/, '/');
  }

  return resolved.endsWith('/') ? resolved : `${resolved}/`;
};

export const TURNS_PLATFORM = 'CUSTOMER_APP';

/**
 * The turns API rejects any request that omits these with
 * 401 "You are passing an invalid value for app name" — regardless of whether
 * the bearer token is valid. They are app identity, not authentication.
 */
export const TURNS_APP_HEADERS: Record<string, string> = {
  'X-App-Name': (import.meta.env.VITE_TURNS_APP_NAME as string) ?? '1.0.0.0',
  'X-App-Version': (import.meta.env.VITE_TURNS_APP_VERSION as string) ?? '10000',
  'Os-Version': (import.meta.env.VITE_TURNS_OS_VERSION as string) ?? '24',
};
