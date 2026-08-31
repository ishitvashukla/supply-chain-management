import { clsx, type ClassValue } from 'clsx';
import { session } from '@/api/tokens';
import { twMerge } from 'tailwind-merge';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

/** Country reported by turns → the ISO currency and locale to format with. */
const CURRENCY_BY_BUILD: Record<string, { code: string; locale: string }> = {
  IN: { code: 'INR', locale: 'en-IN' },
  US: { code: 'USD', locale: 'en-US' },
  CA: { code: 'CAD', locale: 'en-CA' },
  GB: { code: 'GBP', locale: 'en-GB' },
  AU: { code: 'AUD', locale: 'en-AU' },
};

const DEFAULT_CURRENCY = { code: 'USD', locale: 'en-US' };

/**
 * Resolved from the turns login response, so an Indian business sees ₹ and a
 * US one sees $ without any per-call plumbing. Read at call time rather than
 * captured at module load — the value only exists once someone has signed in.
 */
export const activeCurrency = (): { code: string; locale: string } => {
  const locale = session.locale();
  if (!locale) return DEFAULT_CURRENCY;
  return CURRENCY_BY_BUILD[locale.build] ?? DEFAULT_CURRENCY;
};

export const formatCurrency = (value: number, currency?: string): string => {
  const active = activeCurrency();
  return new Intl.NumberFormat(active.locale, {
    style: 'currency',
    currency: currency ?? active.code,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
};

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value ?? 0);

export const formatDate = (value?: string | Date | null, template = 'MMM D, YYYY'): string =>
  value ? dayjs(value).format(template) : '—';

export const formatDateTime = (value?: string | Date | null): string =>
  value ? dayjs(value).format('MMM D, YYYY · h:mm A') : '—';

export const fromNow = (value?: string | Date | null): string =>
  value ? dayjs(value).fromNow() : '—';

/** Title Case a CONSTANT_CASE enum for display. */
export const humanize = (value?: string | null): string =>
  value
    ? value
        .toLowerCase()
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : '—';

export const initials = (name?: string): string =>
  (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

export { dayjs };

/**
 * How a material is bought: "5 L", "12 pieces", or just the unit when the pack
 * holds one. Used anywhere an item's size is shown.
 */
export const formatPack = (packSize?: number | null, unit?: string | null): string => {
  const size = Number(packSize ?? 0);
  const measure = (unit ?? '').trim();
  if (!measure) return size ? String(size) : '—';
  return size && size !== 1 ? `${formatNumber(size)} ${measure}` : measure;
};
