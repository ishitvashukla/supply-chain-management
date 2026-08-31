import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';

export const Topbar = ({ onMenu }: { onMenu: () => void }) => {
  const { user, logout, isAdmin, store } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Icons.menu />
      </Button>

      <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
        <Icons.search className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm text-muted-foreground">
          {isAdmin ? 'Viewing all stores' : `Viewing ${store?.name ?? 'your store'}`}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
        <Badge variant={isAdmin ? 'default' : 'secondary'} className="hidden sm:inline-flex">
          {isAdmin ? 'Admin' : 'Store'}
        </Badge>
        <Button variant="ghost" size="icon" onClick={logout} aria-label={`Sign out ${user?.name}`}>
          <Icons.logout />
        </Button>
      </div>
    </header>
  );
};
