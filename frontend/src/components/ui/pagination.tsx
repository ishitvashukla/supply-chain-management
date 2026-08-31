import type { PageMeta } from '@/types';
import { Button } from './button';
import { Icons } from '@/components/icons';

export const Pagination = ({
  meta,
  onPage,
}: {
  meta?: PageMeta;
  onPage: (page: number) => void;
}) => {
  if (!meta || meta.pages <= 1) return null;

  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
      <p className="text-xs text-muted-foreground">
        {from}–{to} of {meta.total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          <Icons.chevronLeft /> Prev
        </Button>
        <span className="px-1 text-xs text-muted-foreground">
          {meta.page} / {meta.pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page >= meta.pages}
          onClick={() => onPage(meta.page + 1)}
        >
          Next <Icons.chevronRight />
        </Button>
      </div>
    </div>
  );
};
