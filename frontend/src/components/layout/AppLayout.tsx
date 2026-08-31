import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useStoreSync } from '@/hooks/useStoreSync';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/**
 * Three responsive modes:
 *   phone   — bottom tab bar + drawer
 *   tablet  — drawer + wider content grid
 *   desktop — persistent sidebar rail
 */
export const AppLayout = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Mirror the turns store list into this app once per session.
  useStoreSync();

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar mobileOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setDrawerOpen(true)} />

        {/* pb-20 clears the phone tab bar; it collapses from md up. */}
        <main className="flex-1 px-3 pb-20 pt-4 sm:px-4 md:pb-6 lg:px-6">
          <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-5">
            <Outlet />
          </div>
        </main>

        <BottomNav onMore={() => setDrawerOpen(true)} />
      </div>
    </div>
  );
};
