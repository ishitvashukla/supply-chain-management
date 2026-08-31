import { cn } from '@/lib/utils';

/**
 * SupplyHub mark: a hub at the centre with three supply lines running out to
 * store nodes — one catalog feeding many locations, which is the product in a
 * glyph. Drawn in currentColor so it inherits whatever it sits on.
 */
export const BrandMark = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    role="img"
    aria-label="SupplyHub"
    className={cn('size-6', className)}
  >
    {/* supply lines */}
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.45">
      <path d="M16 16 16 7" />
      <path d="M16 16 8.2 20.5" />
      <path d="M16 16 23.8 20.5" />
    </g>

    {/* store nodes */}
    <g fill="currentColor" opacity="0.45">
      <circle cx="16" cy="5.5" r="3.1" />
      <circle cx="6.8" cy="22.2" r="3.1" />
      <circle cx="25.2" cy="22.2" r="3.1" />
    </g>

    {/* central hub */}
    <circle cx="16" cy="16" r="4.6" fill="currentColor" />
  </svg>
);

/** Mark plus wordmark, used in the sidebar and on the login screen. */
export const BrandLockup = ({
  className,
  subtitle,
}: {
  className?: string;
  subtitle?: string;
}) => (
  <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
      <BrandMark className="size-5" />
    </span>
    <span className="min-w-0">
      <span className="block truncate text-sm font-extrabold leading-tight tracking-tight">
        Supply<span className="text-primary">Hub</span>
      </span>
      {subtitle && (
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      )}
    </span>
  </div>
);
