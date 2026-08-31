import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';
import duration from 'dayjs/plugin/duration';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(duration);
dayjs.extend(customParseFormat);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

export type DateInput = dayjs.ConfigType;

/**
 * Single entry point for date handling — always go through this module
 * instead of `new Date()` so formats and timezones stay consistent.
 */
export const now = () => dayjs();

export const utcNow = () => dayjs.utc();

/** ISO-8601 in UTC — the format we store and log in. */
export const toIso = (value: DateInput = dayjs()): string => dayjs(value).utc().toISOString();

export const format = (value: DateInput, template = 'YYYY-MM-DD HH:mm:ss'): string =>
  dayjs(value).format(template);

export const formatInTz = (value: DateInput, tz: string, template = 'YYYY-MM-DD HH:mm:ss'): string =>
  dayjs(value).tz(tz).format(template);

export const fromNow = (value: DateInput): string => dayjs(value).fromNow();

export const isValidDate = (value: DateInput): boolean => dayjs(value).isValid();

export const addDays = (value: DateInput, days: number): Date =>
  dayjs(value).add(days, 'day').toDate();

export const diffIn = (a: DateInput, b: DateInput, unit: dayjs.OpUnitType = 'millisecond'): number =>
  dayjs(a).diff(dayjs(b), unit);

export const startOfDay = (value: DateInput = dayjs()): Date => dayjs(value).startOf('day').toDate();

export const endOfDay = (value: DateInput = dayjs()): Date => dayjs(value).endOf('day').toDate();

export { dayjs };
export default dayjs;
