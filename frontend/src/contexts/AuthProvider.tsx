import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import api from '@/api/client';
import { SESSION_EXPIRED_EVENT, forceLogout, session, tokens } from '@/api/tokens';
import {
  resolveDisplayName,
  resolveUserId,
  turnsLogin,
  turnsLogout,
  type TurnsRole,
} from '@/api/turnsAuth';
import type { Store, User } from '@/types';
import { AuthContext } from './auth-context';

interface DoorSession {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  // Only try to restore when BOTH sessions are present — a half session is
  // treated as no session at all.
  const [isLoading, setIsLoading] = useState(tokens.hasBoth());
  const queryClient = useQueryClient();

  const clearSession = useCallback(() => {
    tokens.clearAll();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  // Either realm failing to refresh signs the user out of both.
  useEffect(() => {
    const onExpired = (event: Event) => {
      const reason = (event as CustomEvent<{ reason: string }>).detail?.reason;
      setUser(null);
      queryClient.clear();
      toast.error(reason ?? 'Your session expired — please sign in again');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [queryClient]);

  useEffect(() => {
    if (!tokens.hasBoth()) {
      // A stale half-session would 401 on every call — drop it now.
      if (tokens.access('turns') || tokens.access('door')) tokens.clearAll();
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    api
      .get<User>('/auth/me')
      .then((res) => {
        if (!cancelled) setUser(res.data);
      })
      .catch(() => {
        tokens.clearAll();
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Signs in to turns directly, then exchanges that session for a door one.
   * Both token pairs are stored; the app is only usable with both.
   */
  const login = useCallback(
    async (role: TurnsRole, username: string, password: string) => {
      const { data, requires2FA } = await turnsLogin(role, username, password);

      if (requires2FA) {
        // The caller routes to the 2FA screen; no session exists yet.
        throw Object.assign(new Error('Two-factor verification required'), {
          requires2FA: true,
          tempToken: data.temp_token,
        });
      }

      const businessId = session.businessId();
      if (!businessId) throw new Error('No business selected');

      try {
        const res = await api.post<DoorSession>('/auth/turns-session', {
          businessId,
          accessToken: data.access_token,
          turnsUserId: resolveUserId(data.details),
          turnsRole: role,
          name: resolveDisplayName(data.details),
          email: data.details.email_id || undefined,
          storeId: data.details.store_id != null ? String(data.details.store_id) : null,
        });

        tokens.set('door', res.data.accessToken, res.data.refreshToken);
        setUser(res.data.user);
      } catch (error) {
        // Turns accepted us but this app did not — don't leave a half session.
        tokens.clearAll();
        throw error;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    // Send the refresh token so only THIS device is signed out; other sessions
    // for the same account keep working.
    const refreshToken = tokens.refresh('door') ?? undefined;

    // Best-effort revocation on both sides; local state is cleared regardless.
    await Promise.allSettled([
      api.post('/auth/logout', { refreshToken }).catch(() => undefined),
      turnsLogout(),
    ]);
    clearSession();
  }, [clearSession]);

  const value = useMemo(() => {
    const store = user?.store && typeof user.store === 'object' ? (user.store as Store) : null;
    return {
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'ADMIN',
      role: user?.role ?? null,
      store,
      storeId: store?._id ?? (typeof user?.store === 'string' ? user.store : null),
      businessId: session.businessId(),
      login,
      logout,
      forceLogout,
    };
  }, [user, isLoading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
