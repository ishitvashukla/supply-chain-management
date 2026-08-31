import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { Role } from '@/types';
import { Icons } from '@/components/icons';

const FullPageSpinner = () => (
  <div className="grid min-h-dvh place-items-center bg-background">
    <Icons.spinner className="size-6 animate-spin text-primary" />
  </div>
);

export const ProtectedRoute = ({ roles }: { roles?: Role[] }) => {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  // A store user landing on an admin-only URL goes home rather than seeing an error.
  if (roles && role && !roles.includes(role)) return <Navigate to="/" replace />;

  return <Outlet />;
};

export const PublicOnlyRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <FullPageSpinner />;
  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />;
};
