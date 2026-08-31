import { createContext } from 'react';
import type { TurnsRole } from '@/api/turnsAuth';
import type { Role, Store, User } from '@/types';

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  role: Role | null;
  /** The store a store-scoped user belongs to; null for admins. */
  store: Store | null;
  storeId: string | null;
  /** The business the session belongs to; turns is multi-tenant. */
  businessId: string | null;
  login: (role: TurnsRole, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  forceLogout: (reason: string) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
