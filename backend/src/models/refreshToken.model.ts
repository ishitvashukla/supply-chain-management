import crypto from 'node:crypto';
import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

/**
 * One row per issued refresh token, so a token can be revoked individually
 * rather than only by invalidating every session the user has.
 *
 * The raw token is never stored — only a SHA-256 digest — so a dump of this
 * collection cannot be replayed against the API.
 */
export interface IRefreshToken {
  user: Types.ObjectId;
  /** Matches the `jti` claim in the signed token. */
  jti: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  /**
   * Why it was revoked. Only ROTATED tokens indicate theft when replayed —
   * a token retired by sign-out or an admin revoke is merely stale, and
   * replaying it must not punish the account's other sessions.
   */
  revokedReason?: 'ROTATED' | 'LOGOUT' | 'REVOKED' | null;
  /** The token issued in its place, for tracing a rotation chain. */
  replacedBy?: string | null;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type RefreshTokenDocument = HydratedDocument<IRefreshToken>;

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jti: { type: String, required: true, unique: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: {
      type: String,
      enum: ['ROTATED', 'LOGOUT', 'REVOKED', null],
      default: null,
    },
    replacedBy: { type: String, default: null },
    userAgent: { type: String },
  },
  { timestamps: true, versionKey: false },
);

// Mongo drops rows once they expire, so the collection stays bounded.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

export const RefreshToken: Model<IRefreshToken> = model<IRefreshToken>(
  'RefreshToken',
  refreshTokenSchema,
);
export default RefreshToken;
