import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import type { Theme } from '@/contexts/theme-context';
import { Icons } from '@/components/icons';

const OPTIONS: { value: Theme; icon: typeof Icons.sun; label: string }[] = [
  { value: 'light', icon: Icons.sun, label: 'Light' },
  { value: 'dark', icon: Icons.moon, label: 'Dark' },
  { value: 'system', icon: Icons.system, label: 'System' },
];

/** Three-way switch: explicit light/dark, or follow the OS. */
export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5"
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            'rounded-md p-1.5 transition-colors [&_svg]:size-4',
            theme === value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
};
