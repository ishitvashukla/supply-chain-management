import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  ThemeToggle,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { humanize } from '@/lib/utils';

export const SettingsPage = () => {
  const { user, store, isAdmin, logout } = useAuth();
  const { theme, resolved } = useTheme();

  return (
    <>
      <PageHeader title="Settings" description="Your account and appearance preferences" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{user?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Role</span>
              <Badge variant={isAdmin ? 'default' : 'secondary'}>{humanize(user?.role)}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Store</span>
              <span className="font-medium">{store?.name ?? 'All stores'}</span>
            </div>
            <Button variant="outline" full onClick={logout}>
              Sign out
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-xs text-muted-foreground">
                  {theme === 'system' ? `Following your system (${resolved})` : humanize(theme)}
                </p>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

      </div>
    </>
  );
};

export default SettingsPage;
