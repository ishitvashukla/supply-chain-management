import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { visibleNav } from './nav-items';
import { Icons } from '@/components/icons';

/**
 * Phone-only tab bar. Kept to four destinations plus "More" so targets stay
 * wide enough to hit, which is what a native wrapper would expect too.
 */
export const BottomNav = ({ onMore }: { onMore: () => void }) => {
  const { role } = useAuth();
  const items = visibleNav(role).filter((item) => item.primary).slice(0, 4);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5">
        {items.map(({ to, short, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )
            }
          >
            <Icon className="size-5" />
            {short}
          </NavLink>
        ))}
        <button
          onClick={onMore}
          className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground"
        >
          <Icons.more className="size-5" />
          More
        </button>
      </div>
    </nav>
  );
};
