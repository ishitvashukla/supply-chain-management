import axios from 'axios';
import CryptoJS from 'crypto-js';
import dayjs from 'dayjs';
import { ApiError } from './client';
import { session, tokens } from './tokens';
import { TURNS_APP_HEADERS, TURNS_PLATFORM, turnsBaseUrl } from './turnsConfig';
import { TURNS } from './turnsEndpoints';
import turnsApi, { type TurnsEnvelope } from './turnsClient';

/** Vendor login is deliberately not offered in this app. */
export type TurnsRole = 'ADMIN' | 'EMPLOYEE' | 'STORE';

export const TURNS_ROLES: { value: TurnsRole; label: string }[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'STORE', label: 'Store' },
];

export interface TurnsLoginDetails {
  id?: string | number;
  user_id?: string | number;
  store_id?: string | number;
  admin_name?: string;
  store_name?: string;
  first_name?: string;
  email_id?: string;
  username?: string;
}

export interface TurnsLoginData {
  details: TurnsLoginDetails;
  access_token: string;
  refresh_token: string;
  currency?: string;
  /** Present only when the account has 2FA turned on. */
  twofa_enabled?: boolean;
  temp_token?: string;
}

/**
 * The backend hashes differently per role — this is the contract, not a choice:
 * ADMIN sends SHA1, EMPLOYEE and STORE send MD5. Sending the raw password, or
 * the wrong digest, is rejected as bad credentials.
 */
const hashPassword = (role: TurnsRole, password: string): string =>
  role === 'ADMIN'
    ? CryptoJS.SHA1(password).toString()
    : CryptoJS.MD5(password).toString();

/** ADMIN identifies by `username`; EMPLOYEE by `email`; STORE by `login`. */
const loginBody = (role: TurnsRole, username: string, password: string) => {
  const hashed = hashPassword(role, password);
  const base = { password: hashed, role, type: '' };

  if (role === 'ADMIN') return { ...base, username };
  if (role === 'EMPLOYEE') return { ...base, email: username };
  return { ...base, login: username };
};

/** The user id the rest of the session is keyed on varies by role. */
export const resolveUserId = (details: TurnsLoginDetails): string =>
  String(details.id ?? details.user_id ?? details.store_id ?? '');

export const resolveDisplayName = (details: TurnsLoginDetails): string =>
  details.admin_name ?? details.store_name ?? details.first_name ?? details.username ?? 'User';

/**
 * Confirms a business id exists before we let the user try to sign in.
 * Runs unauthenticated, so it uses a bare axios call rather than the client.
 */
export const checkBusinessId = async (businessId: string): Promise<boolean> => {
  const trimmed = businessId.trim();
  if (!trimmed) return false;

  try {
    const response = await axios.get(`${turnsBaseUrl(trimmed)}${TURNS.CHECK_BUSINESS}`, {
      headers: {
        'X-Platform': TURNS_PLATFORM,
        'X-Date': dayjs().format('YYYY-MM-DD'),
        ...TURNS_APP_HEADERS,
      },
      validateStatus: () => true,
    });
    return response.status === 200 && response.data?.status !== false;
  } catch {
    return false;
  }
};

export interface TurnsLoginResult {
  data: TurnsLoginData;
  /** True when the caller must complete 2FA before the session is usable. */
  requires2FA: boolean;
}

export const turnsLogin = async (
  role: TurnsRole,
  username: string,
  password: string,
): Promise<TurnsLoginResult> => {
  const response = await turnsApi.post<TurnsLoginData>(
    TURNS.LOGIN,
    loginBody(role, username, password.trim()),
  );

  if (!response.status || !response.data) {
    throw new ApiError(response.message ?? 'Invalid credentials', 401);
  }

  const data = response.data;

  // 2FA: only a temp_token is issued here; the real tokens come after OTP.
  if (data.twofa_enabled === true && data.temp_token) {
    return { data, requires2FA: true };
  }

  if (!data.access_token) {
    throw new ApiError(response.message ?? 'Login did not return a session', 401);
  }

  tokens.set('turns', data.access_token, data.refresh_token);
  session.setRole(role);
  session.setUserId(resolveUserId(data.details));
  session.setProfile({
    name: resolveDisplayName(data.details),
    email: data.details.email_id ?? '',
    username: data.details.username ?? '',
    storeId: data.details.store_id != null ? String(data.details.store_id) : null,
    role,
  });

  return { data, requires2FA: false };
};

export const turnsLogout = async (): Promise<void> => {
  try {
    await turnsApi.post<TurnsEnvelope<unknown>>(TURNS.LOGOUT, {});
  } catch {
    // A failed logout call must never block clearing the local session.
  }
};
