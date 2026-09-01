import { Router, type Request, type Response } from 'express';
import env from '../config/env';
import ApiError from '../utils/ApiError';
import asyncHandler from '../utils/asyncHandler';
import logger from '../utils/logger';

const router = Router();

/** Only these hosts may ever be proxied — otherwise this is an open relay. */
const ALLOWED_HOST_SUFFIXES = ['turnsapp.com', 'sifabso.com'];

const targetFor = (businessId: string, path: string): string => {
  const base = env.turnsBaseUrl.replace('{BUSINESS_ID}', businessId);
  const url = new URL(path.replace(/^\/+/, ''), base.endsWith('/') ? base : `${base}/`);

  const allowed = ALLOWED_HOST_SUFFIXES.some(
    (suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`),
  );
  if (!allowed) throw ApiError.badRequest(`Refusing to proxy to ${url.hostname}`);

  return url.toString();
};

/**
 * Forwards a call to the turns backend.
 *
 * The browser cannot call turns directly from a deployed origin: turns only
 * returns CORS headers for allowlisted origins, and ours is not one. In dev
 * that was papered over by a vite proxy, which does not exist in production —
 * so the request is relayed here instead, where CORS does not apply.
 *
 * Deliberately unauthenticated against *our* API: the caller's turns bearer
 * token is what turns checks, and login has to work before a session exists.
 */
router.all(
  '/:businessId/*splat',
  asyncHandler(async (req: Request, res: Response) => {
    const businessId = req.params.businessId as string;
    const path = (req.params as Record<string, string[] | string>).splat;
    const target = targetFor(businessId, Array.isArray(path) ? path.join('/') : String(path ?? ''));

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Platform': 'CUSTOMER_APP',
      'X-Date': new Date().toISOString().slice(0, 10),
      'X-App-Name': env.turnsAppName,
      'X-App-Version': env.turnsAppVersion,
      'Os-Version': env.turnsOsVersion,
    };

    // Pass through only what turns needs; never the browser's cookies or host.
    const auth = req.headers.authorization;
    if (auth) headers.Authorization = auth;
    const userId = req.headers['x-user-id'];
    if (typeof userId === 'string') headers['X-User-ID'] = userId;

    try {
      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body ?? {}),
        signal: AbortSignal.timeout(20_000),
      });

      const text = await upstream.text();
      res.status(upstream.status);
      res.type(upstream.headers.get('content-type') ?? 'application/json');
      res.send(text);
    } catch (error) {
      logger.error('Turns proxy failed:', error instanceof Error ? error.message : error);
      throw new ApiError(502, 'Could not reach the turns backend');
    }
  }),
);

export default router;
