import { useEffect, useRef } from 'react';
import { useSyncStoresFromTurns, useTurnsStores } from '@/api/hooks';
import { useAuth } from './useAuth';

/**
 * Keeps this app's store records in step with turns, which owns them.
 *
 * Runs once per session: turns is the source of truth for the list, but orders,
 * inventory and expenses all reference a local Store document, so each turns
 * store needs a local counterpart before those screens can work.
 */
export const useStoreSync = (): void => {
  const { isAuthenticated, isAdmin } = useAuth();
  const turnsStores = useTurnsStores();
  const sync = useSyncStoresFromTurns();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    if (!isAuthenticated || !isAdmin) return;

    const stores = turnsStores.data;
    if (!stores?.length) return;

    done.current = true;
    // Failure is non-fatal: the app still works against whatever is already
    // mirrored, and the next session retries.
    sync.mutate(stores);
  }, [isAuthenticated, isAdmin, turnsStores.data, sync]);
};
