import type { Role } from '../constants';

/** Identity attached by the auth middleware; every protected route can rely on it. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Null for admins, the user's own store for store-scoped roles. */
  storeId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
