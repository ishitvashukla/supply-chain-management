import type { Request, Response } from 'express';
import authService from '../services/auth.service';
import { runInTenant } from '../lib/tenantContext';
import { upsertTurnsUser } from '../services/turns.service';
import ApiError from '../utils/ApiError';
import { sendSuccess } from '../utils/ApiResponse';
import asyncHandler from '../utils/asyncHandler';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  return sendSuccess(res, { message: 'Signed in', data: result });
});

/** Admin-only: there is no public sign-up in this app. */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  return sendSuccess(res, { statusCode: 201, message: 'User created', data: result });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await authService.me(req.user.id);
  return sendSuccess(res, { message: 'Current user', data: user });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, currentPassword, newPassword);
  return sendSuccess(res, { message: 'Password updated' });
});

/**
 * Exchanges a verified turns session for a door session. The client signs in to
 * turns directly, then calls this so both token pairs exist side by side.
 */
export const turnsSession = asyncHandler(async (req: Request, res: Response) => {
  // Unauthenticated, so there is no session to take the franchise from — it
  // comes from the payload, and everything below runs inside that scope.
  const data = await runInTenant(String(req.body.businessId), async () => {
    const user = await upsertTurnsUser(req.body);
    return authService.issueSession(user, req.headers['user-agent']);
  });

  return sendSuccess(res, { message: 'Signed in', data });
});

/** Issues a fresh door token pair from a door refresh token. */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.refresh(req.body.refreshToken, req.headers['user-agent']);
  return sendSuccess(res, { message: 'Session refreshed', data: result });
});

/** Revokes every outstanding refresh token for the current user. */
/**
 * Signs out this device by revoking the refresh token it presents. Pass
 * `allDevices: true` to invalidate every session the account has.
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken, allDevices } = req.body ?? {};

  if (allDevices && req.user) {
    await authService.revokeSessions(req.user.id);
  } else if (refreshToken) {
    await authService.revokeOne(refreshToken);
  } else if (req.user) {
    await authService.revokeSessions(req.user.id);
  }

  return sendSuccess(res, { message: 'Signed out' });
});
