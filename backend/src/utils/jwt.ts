import jwt, { type SignOptions } from 'jsonwebtoken';
import env from '../config/env';
import type { Role } from '../constants';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  storeId: string | null;
}

export interface RefreshPayload {
  sub: string;
  /** Bumped when every session is revoked at once. */
  v: number;
  /** Identifies this specific token, so it can be rotated and revoked alone. */
  jti: string;
}

export const signToken = (payload: JwtPayload): string =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as SignOptions);

export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, env.jwtSecret) as JwtPayload;

/** Refresh tokens are signed with a *different* secret, so a leaked access
 *  token can never be replayed as a refresh token. */
export const signRefreshToken = (payload: RefreshPayload): string =>
  jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
  } as SignOptions);

export const verifyRefreshToken = (token: string): RefreshPayload =>
  jwt.verify(token, env.jwtRefreshSecret) as RefreshPayload;
