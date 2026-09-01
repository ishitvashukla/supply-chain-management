import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ROLES, STORE_ROLES, type Role } from '../constants';
import { runInTenant, runUnscoped } from '../lib/tenantContext';
import User from '../models/user.model';
import ApiError from '../utils/ApiError';
import asyncHandler from '../utils/asyncHandler';
import { verifyToken } from '../utils/jwt';

/** Verifies the bearer token and loads the current user onto `req.user`. */
export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }

  const token = header.slice('Bearer '.length).trim();

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  // Re-read the user so a deactivated account can't keep using a live token.
  // Unscoped: which franchise this request belongs to is only known once the
  // user is loaded, so this one lookup happens before the tenant is set.
  const user = await runUnscoped(() => User.findById(payload.sub));
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account is no longer active');
  }

  const businessId = user.businessId ?? '';
  if (!businessId) {
    // Without a franchise there is nothing safe to scope queries to.
    throw ApiError.forbidden('This account is not linked to a business');
  }

  req.user = {
    id: user.id as string,
    email: user.email,
    name: user.name,
    role: user.role,
    storeId: user.store ? String(user.store) : null,
    businessId,
  };

  // Everything downstream — controllers, services, every query — runs inside
  // this franchise's scope.
  await runInTenant(businessId, () => {
    next();
  });
});

/** Restricts a route to the given roles. Must run after `authenticate`. */
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(ApiError.forbidden(`Requires one of: ${roles.join(', ')}`));
      return;
    }
    next();
  };

export const requireAdmin = requireRole(ROLES.ADMIN);

/**
 * Resolves which store a request is acting on.
 * Admins may target any store via `storeId`; store users are pinned to theirs
 * regardless of what they send, which is what keeps one store out of another's data.
 */
export const resolveStoreScope = (req: Request, requested?: string): string => {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();

  if (STORE_ROLES.includes(user.role)) {
    if (!user.storeId) throw ApiError.forbidden('Your account has no store assigned');
    if (requested && requested !== user.storeId) {
      throw ApiError.forbidden('You can only access your own store');
    }
    return user.storeId;
  }

  if (!requested) throw ApiError.badRequest('storeId is required');
  return requested;
};

/** Admin-only when no store is given; otherwise the caller's own store. */
export const optionalStoreScope = (req: Request, requested?: string): string | undefined => {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();
  if (STORE_ROLES.includes(user.role)) return user.storeId ?? undefined;
  return requested;
};
