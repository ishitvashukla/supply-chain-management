import type { ReactNode } from 'react';
import { Icons } from '@/components/icons';

export const EmptyState = ({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
    <div className="rounded-full bg-muted p-3 text-muted-foreground [&_svg]:size-6">
      {icon ?? <Icons.empty />}
    </div>
    <div className="space-y-1">
      <p className="font-medium">{title}</p>
      {description && (
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
    </div>
    {action}
  </div>
);
