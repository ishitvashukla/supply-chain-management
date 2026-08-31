import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';
import { EmptyState } from './empty-state';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  /** Hide below the given breakpoint to keep narrow screens readable. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  align?: 'left' | 'right' | 'center';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  empty?: { title: string; description?: string; action?: ReactNode };
  /** Card layout used on phones instead of a squashed table. */
  mobileCard?: (row: T) => ReactNode;
}

const HIDE = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' };

/**
 * Table on tablet and desktop; stacked cards on phones when `mobileCard` is
 * supplied, so no horizontal scrolling is needed on small screens.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  onRowClick,
  empty,
  mobileCard,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <EmptyState
        title={empty?.title ?? 'Nothing here yet'}
        description={empty?.description}
        action={empty?.action}
      />
    );
  }

  return (
    <>
      {mobileCard && (
        <div className="space-y-2 p-3 md:hidden">
          {rows.map((row) => (
            <div
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'rounded-lg border border-border bg-background p-3',
                onRowClick && 'cursor-pointer active:bg-accent/50',
              )}
            >
              {mobileCard(row)}
            </div>
          ))}
        </div>
      )}

      <div
        className={cn('scrollbar-thin w-full overflow-x-auto', mobileCard ? 'hidden md:block' : '')}
      >
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                    ALIGN[column.align ?? 'left'],
                    column.hideBelow && HIDE[column.hideBelow],
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-border/60 transition-colors last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-accent/40',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3 align-middle',
                      ALIGN[column.align ?? 'left'],
                      column.hideBelow && HIDE[column.hideBelow],
                      column.className,
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
