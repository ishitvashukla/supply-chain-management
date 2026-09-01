import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  /** The franchise this request belongs to. */
  businessId: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

/**
 * Runs `fn` with every database query inside it scoped to one franchise.
 *
 * Awaits the result *inside* the scope. Mongoose queries are lazy — returning
 * one unexecuted would run it after the scope had exited, where there is no
 * tenant and it would match nothing. Awaiting here means callers cannot get
 * that wrong, at the cost of always returning a promise.
 */
export const runInTenant = async <T>(businessId: string, fn: () => T | Promise<T>): Promise<T> =>
  storage.run({ businessId }, async () => await fn());

export const currentBusinessId = (): string | undefined => storage.getStore()?.businessId;

/**
 * Escape hatch for the few operations that legitimately span franchises:
 * authenticating (we don't know the tenant until the user is loaded) and
 * refresh-token lookups, which are keyed by an unguessable jti.
 *
 * Deliberately explicit and rare — anything using this is opting out of the
 * protection that keeps one franchise's data away from another.
 */
export const runUnscoped = async <T>(fn: () => T | Promise<T>): Promise<T> =>
  storage.run({ businessId: '' }, async () => await fn());

export const isUnscoped = (): boolean => storage.getStore()?.businessId === '';
