import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Popover } from './popover';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectMenuProps<T extends string = string> {
  value: T | '';
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  /** Adds a filter box once the list is long enough to need one. */
  searchable?: boolean;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
  /** Rendered as the first option and selects the empty value. */
  clearLabel?: string;
}

/**
 * Listbox-style select.
 *
 * Replaces the native control so options can carry descriptions and match the
 * app's theme — a native <select>'s option list is drawn by the OS and ignores
 * our styling entirely.
 */
export function SelectMenu<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchable,
  disabled,
  error,
  className,
  id,
  clearLabel,
  ...rest
}: SelectMenuProps<T>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const showSearch = searchable ?? options.length > 8;

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const needle = query.toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  const selected = options.find((option) => option.value === value);

  const commit = (option: SelectOption<T>) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) commit(option);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className={cn('relative w-full', className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={rest['aria-label']}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={onKeyDown}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-base transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm',
          error && 'border-destructive focus-visible:ring-destructive',
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected?.label ?? placeholder}
        </span>
        <Icons.chevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={triggerRef}>
        {showSearch && (
          <div className="sticky top-0 bg-popover p-1">
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search…"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        )}

        <ul role="listbox" className="space-y-0.5">
          {clearLabel && (
            <li>
              <button
                type="button"
                onClick={() => {
                  onChange('' as T);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground',
                  'hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {clearLabel}
              </button>
            </li>
          )}

          {!filtered.length && (
            <li className="px-2.5 py-6 text-center text-sm text-muted-foreground">No matches</li>
          )}

          {filtered.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(option)}
                  className={cn(
                    'flex w-full items-start justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    index === activeIndex && 'bg-accent text-accent-foreground',
                    isSelected && 'font-medium',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.description && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {isSelected && <Icons.approve className="size-4 shrink-0 text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
      </Popover>
    </div>
  );
}

/** Convenience for the common `VALUE -> Title Case` option list. */
export const toOptions = <T extends string>(
  values: readonly T[],
  label: (value: T) => string,
): SelectOption<T>[] => values.map((value) => ({ value, label: label(value) }));

export type { ReactNode };
