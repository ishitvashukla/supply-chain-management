import type { ReactNode } from 'react';
import { cn, formatNumber } from '@/lib/utils';
import { Card } from './card';
import { Skeleton } from './skeleton';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  loading?: boolean;
}

const TONE = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-destructive/12 text-destructive',
  info: 'bg-info/12 text-info',
};

export const StatCard = ({ label, value, hint, icon, tone = 'default', loading }: StatCardProps) => (
  <Card className="p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
            {typeof value === 'number' ? formatNumber(value) : value}
          </p>
        )}
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      {icon && (
        <div className={cn('shrink-0 rounded-lg p-2 [&_svg]:size-5', TONE[tone])}>{icon}</div>
      )}
    </div>
  </Card>
);
