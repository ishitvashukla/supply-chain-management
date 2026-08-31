import { useMemo, useRef, useState } from 'react';
import { Icons } from '@/components/icons';
import { cn, dayjs } from '@/lib/utils';
import { Button } from './button';
import { Popover } from './popover';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export interface DatePickerProps {
  /** ISO `YYYY-MM-DD`. Empty string means no date. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  id?: string;
  clearable?: boolean;
  'aria-label'?: string;
}

/**
 * Calendar date picker.
 *
 * Built rather than using `<input type="date">` because that control's
 * appearance is entirely browser-controlled — it ignores the app's theme and
 * looks different in every browser. Values stay ISO `YYYY-MM-DD`, so callers
 * can hand them straight to the API.
 */
export const DatePicker = ({
  value,
  onChange,
  placeholder = 'Pick a date',
  min,
  max,
  disabled,
  error,
  className,
  id,
  clearable = true,
  ...rest
}: DatePickerProps) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() =>
    value ? dayjs(value).startOf('month') : dayjs().startOf('month'),
  );

  const selected = value ? dayjs(value) : null;
  const minDate = min ? dayjs(min) : null;
  const maxDate = max ? dayjs(max) : null;

  // Six rows always, so the popover doesn't resize as months change.
  const days = useMemo(() => {
    const start = cursor.startOf('month');
    // dayjs day(): 0 = Sunday. Shift so the grid starts on Monday.
    const offset = (start.day() + 6) % 7;
    const gridStart = start.subtract(offset, 'day');
    return Array.from({ length: 42 }, (_, index) => gridStart.add(index, 'day'));
  }, [cursor]);

  const isDisabled = (day: dayjs.Dayjs): boolean =>
    Boolean((minDate && day.isBefore(minDate, 'day')) || (maxDate && day.isAfter(maxDate, 'day')));

  const pick = (day: dayjs.Dayjs) => {
    if (isDisabled(day)) return;
    onChange(day.format('YYYY-MM-DD'));
    setOpen(false);
  };

  return (
    <div className={cn('relative w-full', className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={rest['aria-label'] ?? 'Choose date'}
        onClick={() => {
          setCursor(value ? dayjs(value).startOf('month') : dayjs().startOf('month'));
          setOpen((prev) => !prev);
        }}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-base transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm',
          error && 'border-destructive focus-visible:ring-destructive',
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected ? selected.format('MMM D, YYYY') : placeholder}
        </span>
        <Icons.orders className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={triggerRef} className="p-3">
        <div className="w-full min-w-[16rem]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCursor((c) => c.subtract(1, 'month'))}
              aria-label="Previous month"
            >
              <Icons.chevronLeft />
            </Button>
            <span className="text-sm font-semibold">{cursor.format('MMMM YYYY')}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCursor((c) => c.add(1, 'month'))}
              aria-label="Next month"
            >
              <Icons.chevronRight />
            </Button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((day) => (
              <span
                key={day}
                className="py-1 text-center text-[11px] font-medium uppercase text-muted-foreground"
              >
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const outside = day.month() !== cursor.month();
              const isSelected = selected?.isSame(day, 'day') ?? false;
              const isToday = day.isSame(dayjs(), 'day');
              const blocked = isDisabled(day);

              return (
                <button
                  key={day.toString()}
                  type="button"
                  disabled={blocked}
                  onClick={() => pick(day)}
                  aria-current={isToday ? 'date' : undefined}
                  className={cn(
                    'grid h-9 place-items-center rounded-md text-sm transition-colors',
                    outside && 'text-muted-foreground/50',
                    !isSelected && !blocked && 'hover:bg-accent hover:text-accent-foreground',
                    isToday && !isSelected && 'font-semibold text-primary',
                    isSelected && 'bg-primary font-semibold text-primary-foreground',
                    blocked && 'cursor-not-allowed opacity-30',
                  )}
                >
                  {day.date()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
            <Button variant="ghost" size="sm" onClick={() => pick(dayjs())}>
              Today
            </Button>
            {clearable && value && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </Popover>
    </div>
  );
};
