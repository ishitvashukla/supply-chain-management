/**
 * Two independent sessions live side by side:
 *   turns — issued by the turns backend, used for store/catalog data there
 *   door  — issued by this app's own API, used for orders/inventory/expenses
 *
 * Both must stay valid. If either one expires and cannot be refreshed, the
 * user is signed out of both rather than left in a half-authenticated state
 * where some screens work and others 401.
 */
export type Realm = 'turns' | 'door';

/**
 * Every key is namespaced.
 *
 * turns-dashboard also runs on localhost:3000 in dev, so it shares this
 * origin's localStorage. Its `bid` / `access_token` / `refresh_token` /
 * `X-User-ID` keys would otherwise collide with ours — and its values are
 * AES-encrypted, so a collision reads back as garbage rather than failing
 * loudly. The prefix keeps the two apps' sessions completely separate.
 */
const NS = 'supplyhub:';

const KEYS = {
  turns: { access: `${NS}turns_access_token`, refresh: `${NS}turns_refresh_token` },
  door: { access: `${NS}door_access_token`, refresh: `${NS}door_refresh_token` },
} as const;

const BID_KEY = `${NS}bid`;

/**
 * Cleared on sign-out. The business id is deliberately NOT here: it is a
 * tenant selection, not a credential, and wiping it on a failed sign-in left
 * the next attempt reporting "No business selected".
 */
const SESSION_KEYS = [
  `${NS}locale`,
  `${NS}turns_user_id`,
  `${NS}turns_role`,
  `${NS}turns_profile`,
] as const;

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode — the session simply won't survive a reload */
  }
};

const drop = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* no-op */
  }
};

export const tokens = {
  access: (realm: Realm): string | null => read(KEYS[realm].access),
  refresh: (realm: Realm): string | null => read(KEYS[realm].refresh),

  set: (realm: Realm, access: string, refresh?: string): void => {
    write(KEYS[realm].access, access);
    if (refresh) write(KEYS[realm].refresh, refresh);
  },

  setAccess: (realm: Realm, access: string): void => write(KEYS[realm].access, access),

  clear: (realm: Realm): void => {
    drop(KEYS[realm].access);
    drop(KEYS[realm].refresh);
  },

  /** Both realms are cleared together — see the note at the top of this file. */
  clearAll: (): void => {
    (Object.keys(KEYS) as Realm[]).forEach((realm) => tokens.clear(realm));
    SESSION_KEYS.forEach(drop);
  },

  /** True only when both sessions have an access token. */
  hasBoth: (): boolean => Boolean(tokens.access('turns') && tokens.access('door')),
};

/* ------------------------------------------------------- session metadata */

export const session = {
  businessId: (): string | null => read(BID_KEY),
  setBusinessId: (value: string): void => write(BID_KEY, value),
  /** Only called when the user explicitly switches business. */
  clearBusinessId: (): void => drop(BID_KEY),

  userId: (): string | null => read(`${NS}turns_user_id`),
  setUserId: (value: string): void => write(`${NS}turns_user_id`, value),

  role: (): string | null => read(`${NS}turns_role`),
  setRole: (value: string): void => write(`${NS}turns_role`, value),

  /**
   * Currency and country, as reported by the turns login response
   * (`currency`, `current_build`). Kept so money renders correctly for the
   * business without a second round trip.
   */
  locale: (): { currency: string; build: string } | null => {
    const raw = read(`${NS}locale`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { currency: string; build: string };
    } catch {
      return null;
    }
  },
  setLocale: (value: { currency: string; build: string }): void =>
    write(`${NS}locale`, JSON.stringify(value)),

  profile: <T>(): T | null => {
    const raw = read(`${NS}turns_profile`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setProfile: (value: unknown): void => write(`${NS}turns_profile`, JSON.stringify(value)),
};

/**
 * Broadcast so any part of the app can force a sign-out when a refresh fails,
 * without the API layer importing React context.
 */
export const SESSION_EXPIRED_EVENT = 'supplyhub:session-expired';

export const forceLogout = (reason: string): void => {
  tokens.clearAll();
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { reason } }));
};
