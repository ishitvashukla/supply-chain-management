import { ROLES, type Role } from '../constants';
import env from '../config/env';
import User from '../models/user.model';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';

/** Roles the turns backend issues. VENDOR is deliberately not accepted here. */
export type TurnsRole = 'ADMIN' | 'EMPLOYEE' | 'STORE';

/** How a turns role maps onto this app's own permission model. */
const ROLE_MAP: Record<TurnsRole, Role> = {
  ADMIN: ROLES.ADMIN,
  EMPLOYEE: ROLES.STORE_STAFF,
  STORE: ROLES.STORE_MANAGER,
};

const baseUrlFor = (businessId: string): string => {
  const resolved = env.turnsBaseUrl.replace('{BUSINESS_ID}', businessId);
  return resolved.endsWith('/') ? resolved : `${resolved}/`;
};

/**
 * Verifies a turns access token by calling the turns backend with it.
 *
 * The client hands us a token it obtained directly; we must not take its word
 * for who the user is, so we re-present the token to turns and only trust the
 * result if turns accepts it.
 */
export const verifyTurnsToken = async (
  businessId: string,
  accessToken: string,
  turnsUserId: string,
): Promise<boolean> => {
  const url = `${baseUrlFor(businessId)}index.php/intapi/api/store_list`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Platform': 'CUSTOMER_APP',
        'X-User-ID': turnsUserId,
        'X-Date': new Date().toISOString().slice(0, 10),
        // Required: without these the API replies 401 "You are passing an
        // invalid value for app name" regardless of how valid the token is.
        'X-App-Name': env.turnsAppName,
        'X-App-Version': env.turnsAppVersion,
        'Os-Version': env.turnsOsVersion,
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return false;
    const body = (await response.json()) as { status?: boolean };
    return body?.status === true;
  } catch (error) {
    logger.error('Turns verification failed:', error instanceof Error ? error.message : error);
    return false;
  }
};

export interface TurnsSessionInput {
  businessId: string;
  accessToken: string;
  turnsUserId: string;
  turnsRole: TurnsRole;
  name: string;
  email?: string;
  storeId?: string | null;
}

/**
 * Links a verified turns identity to a local user, creating one on first sign
 * in. The local user is what this app's own endpoints authorise against.
 */
export const upsertTurnsUser = async (input: TurnsSessionInput) => {
  const verified = await verifyTurnsToken(input.businessId, input.accessToken, input.turnsUserId);
  if (!verified) {
    throw ApiError.unauthorized('Turns session could not be verified');
  }

  const role = ROLE_MAP[input.turnsRole];
  if (!role) throw ApiError.forbidden(`Role ${input.turnsRole} cannot sign in to this app`);

  // Synthesised when turns has no email, so the unique index still holds.
  const email = (
    input.email?.trim() || `${input.turnsRole.toLowerCase()}.${input.turnsUserId}@${input.businessId}.turns`
  ).toLowerCase();

  const existing = await User.findOne({
    turnsUserId: input.turnsUserId,
    businessId: input.businessId,
  });

  if (existing) {
    existing.name = input.name;
    existing.role = role;
    existing.turnsRole = input.turnsRole;
    existing.lastLoginAt = new Date();
    if (input.email) existing.email = email;
    await existing.save({ validateBeforeSave: false });
    return existing;
  }

  return User.create({
    name: input.name,
    email,
    // Never used to sign in — turns owns authentication for these accounts.
    password: `turns:${input.turnsUserId}:${Date.now()}`,
    role,
    turnsUserId: input.turnsUserId,
    turnsRole: input.turnsRole,
    businessId: input.businessId,
    lastLoginAt: new Date(),
  });
};

export default { verifyTurnsToken, upsertTurnsUser };
