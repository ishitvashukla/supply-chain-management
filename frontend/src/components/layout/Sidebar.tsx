import { NavLink } from 'react-router-dom';
import { cn, initials } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { BrandLockup } from '@/components/BrandMark';
import { Button } from '@/components/ui';
import { visibleNav } from './nav-items';
import { Icons } from '@/components/icons';

/**
 * Persistent rail from `lg` up; the same markup doubles as the slide-in drawer
 * on tablet and phone.
 */
export const Sidebar = ({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
}) => {
  const { user, role, store } = useAuth();
  const items = visibleNav(role);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-200',
          'lg:static lg:z-auto lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <BrandLockup subtitle={store?.name ?? 'All stores'} />
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onClose} aria-label="Close menu">
            <Icons.close />
          </Button>
        </div>

        <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto p-3">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
              {initials(user?.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {role?.replace('_', ' ').toLowerCase()}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
