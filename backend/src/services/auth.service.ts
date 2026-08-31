import { ROLES, STORE_ROLES, type Role } from '../constants';
import Store from '../models/store.model';
import User, { type UserDocument } from '../models/user.model';
import ApiError from '../utils/ApiError';
import crypto from 'node:crypto';
import env from '../config/env';
import RefreshToken, { hashToken } from '../models/refreshToken.model';
import { signRefreshToken, signToken, verifyRefreshToken } from '../utils/jwt';
import logger from '../utils/logger';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  store?: string | null;
  phone?: string;
}

const REFRESH_TTL_MS = (() => {
  const raw = env.jwtRefreshExpiresIn;
  const match = /^(\d+)([smhd])$/.exec(raw);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return value * unit;
})();

/**
 * Issues an access/refresh pair and records the refresh token so it can later
 * be rotated or revoked on its own.
 */
const issueSession = async (user: UserDocument, userAgent?: string) => {
  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken({
    sub: user.id as string,
    v: user.tokenVersion,
    jti,
  });

  await RefreshToken.create({
    user: user._id,
    jti,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    userAgent,
  });

  return {
    accessToken: signToken({
      sub: user.id as string,
      email: user.email,
      role: user.role,
      storeId: user.store ? String(user.store) : null,
    }),
    refreshToken,
    user: user.toJSON(),
  };
};


export const authService = {
  issueSession,

  /** Creating users is an admin action; there is no public sign-up. */
  async register(input: RegisterInput) {
    const existing = await User.findOne({ email: input.email.toLowerCase() });
    if (existing) throw ApiError.conflict('A user with that email already exists');

    if (STORE_ROLES.includes(input.role)) {
      if (!input.store) throw ApiError.badRequest('store is required for store-scoped roles');
      const store = await Store.findById(input.store);
      if (!store) throw ApiError.notFound('Store not found');
    }

    const user = await User.create({
      ...input,
      store: input.role === ROLES.ADMIN ? null : input.store,
    });

    return issueSession(user);
  },

  async login(email: string, password: string) {
    // `password` is select:false on the schema, so ask for it explicitly.
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    // Same message either way — don't reveal which emails exist.
    if (!user) throw ApiError.unauthorized('Invalid email or password');
    if (!user.isActive) throw ApiError.forbidden('Account is deactivated');

    const matches = await user.comparePassword(password);
    if (!matches) throw ApiError.unauthorized('Invalid email or password');

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    return issueSession(user);
  },

  async me(userId: string) {
    const user = await User.findById(userId).populate('store', 'name code currency timezone');
    if (!user) throw ApiError.notFound('User not found');
    return user;
  },

  /**
   * Rotates a refresh token: the presented one is retired and a brand new pair
   * is issued. Re-use of an already-rotated token is treated as theft and
   * kills every session for that user.
   */
  async refresh(refreshToken: string, userAgent?: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) throw ApiError.unauthorized('Account is no longer active');
    if (user.tokenVersion !== payload.v) {
      throw ApiError.unauthorized('Session was revoked — please sign in again');
    }

    const record = await RefreshToken.findOne({ jti: payload.jti });
    if (!record) throw ApiError.unauthorized('Refresh token is no longer valid');
    if (record.tokenHash !== hashToken(refreshToken)) {
      throw ApiError.unauthorized('Refresh token does not match');
    }

    if (record.revokedAt) {
      // Retired by sign-out or an admin revoke: stale, not stolen. Reject this
      // one token and leave the account's other sessions alone.
      if (record.revokedReason !== 'ROTATED') {
        throw ApiError.unauthorized('Session has ended — please sign in again');
      }

      const age = Date.now() - record.revokedAt.getTime();

      // Two tabs refreshing at the same instant both present the same token.
      // Inside the grace window that is normal, so issue a fresh pair rather
      // than treating it as an attack.
      if (age <= env.refreshGraceSeconds * 1000 && record.replacedBy) {
        const replacement = await RefreshToken.findOne({ jti: record.replacedBy });
        if (replacement && !replacement.revokedAt) {
          return issueSession(user, userAgent);
        }
      }

      // A rotated token replayed outside the window means it leaked.
      logger.warn(`Refresh token reuse detected for user ${user.id} — revoking all sessions`);
      await this.revokeSessions(String(user.id));
      throw ApiError.unauthorized('Session was revoked — please sign in again');
    }

    const next = await issueSession(user, userAgent);
    const nextPayload = verifyRefreshToken(next.refreshToken);

    record.revokedAt = new Date();
    record.revokedReason = 'ROTATED';
    record.replacedBy = nextPayload.jti;
    await record.save();

    return next;
  },

  /** Invalidates every outstanding refresh token for this user. */
  async revokeSessions(userId: string) {
    await Promise.all([
      User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } }),
      RefreshToken.updateMany(
        { user: userId, revokedAt: null },
        { $set: { revokedAt: new Date(), revokedReason: 'REVOKED' } },
      ),
    ]);
  },

  /** Signs out one device: revokes just the refresh token it presented. */
  async revokeOne(refreshToken: string) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await RefreshToken.updateOne(
        { jti: payload.jti, revokedAt: null },
        { $set: { revokedAt: new Date(), revokedReason: 'LOGOUT' } },
      );
    } catch {
      // An unparseable token has nothing to revoke — signing out still succeeds.
    }
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await User.findById(userId).select('+password');
    if (!user) throw ApiError.notFound('User not found');

    const matches = await user.comparePassword(currentPassword);
    if (!matches) throw ApiError.unauthorized('Current password is incorrect');

    user.password = newPassword;
    await user.save();
  },
};

export default authService;
