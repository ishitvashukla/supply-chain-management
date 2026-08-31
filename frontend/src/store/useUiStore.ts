import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Client-only UI state. Server data stays in TanStack Query — this holds just
 * the things the user picks that must survive navigation and reloads, so pages
 * don't each keep their own copy of "which store am I looking at".
 */
interface UiState {
  /** Admin's active store filter; store users are pinned server-side anyway. */
  selectedStoreId: string;
  setSelectedStoreId: (id: string) => void;

  /** Analytics window, shared by every chart. */
  rangeDays: number;
  setRangeDays: (days: number) => void;

  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedStoreId: '',
      setSelectedStoreId: (selectedStoreId) => set({ selectedStoreId }),

      rangeDays: 30,
      setRangeDays: (rangeDays) => set({ rangeDays }),

      sidebarOpen: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'supplyhub-ui',
      // The drawer must never restore as open on a fresh load.
      partialize: (state) => ({
        selectedStoreId: state.selectedStoreId,
        rangeDays: state.rangeDays,
      }),
    },
  ),
);

/**
 * The store id a page should query with: an admin's chosen store, or the
 * store user's own store, which they cannot change.
 */
export const useActiveStoreId = (ownStoreId: string | null, isAdmin: boolean): string =>
  useUiStore((state) => (isAdmin ? state.selectedStoreId : (ownStoreId ?? '')));
