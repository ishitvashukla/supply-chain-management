import { Icons, type IconComponent } from '@/components/icons';
import type { Role } from '@/types';

export interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: IconComponent;
  roles?: Role[];
  /** Shown in the phone bottom bar (max 5). */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: Icons.dashboard, primary: true },
  { to: '/catalog', label: 'Catalog', short: 'Catalog', icon: Icons.catalog, primary: true },
  { to: '/orders', label: 'Orders', short: 'Orders', icon: Icons.orders, primary: true },
  { to: '/inventory', label: 'Inventory', short: 'Stock', icon: Icons.inventory, primary: true },
  { to: '/payments', label: 'Payments', short: 'Pay', icon: Icons.payments },
  { to: '/analytics', label: 'Analytics', short: 'Stats', icon: Icons.analytics },
  { to: '/items', label: 'Items', short: 'Items', icon: Icons.products, roles: ['ADMIN'] },
  { to: '/settings', label: 'Settings', short: 'More', icon: Icons.settings },
];

export const visibleNav = (role: Role | null): NavItem[] =>
  NAV_ITEMS.filter((item) => !item.roles || (role && item.roles.includes(role)));
