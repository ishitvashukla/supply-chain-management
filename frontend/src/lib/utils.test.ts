import { describe, expect, it } from 'vitest';
import { formatCurrency, formatPack, humanize, initials } from './utils';

describe('formatPack', () => {
  it('reads as a pack when the size is more than one', () => {
    expect(formatPack(5, 'L')).toBe('5 L');
    expect(formatPack(100, 'pieces')).toBe('100 pieces');
  });

  it('drops a pack size of one — "1 L" reads worse than "L"', () => {
    expect(formatPack(1, 'L')).toBe('L');
  });

  it('survives missing data rather than printing undefined', () => {
    expect(formatPack(undefined, undefined)).toBe('—');
    expect(formatPack(5, '')).toBe('5');
  });
});

describe('humanize', () => {
  it('turns CONSTANT_CASE into words', () => {
    expect(humanize('BANK_TRANSFER')).toBe('Bank Transfer');
    expect(humanize('PENDING')).toBe('Pending');
  });

  it('does not print "undefined" for a missing value', () => {
    expect(humanize(undefined)).toBe('—');
  });
});

describe('formatCurrency', () => {
  it('formats money', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });

  it('falls back to zero rather than NaN', () => {
    expect(formatCurrency(Number.NaN)).toBe('$0.00');
  });
});

describe('initials', () => {
  it('takes at most two initials', () => {
    expect(initials('John Dawson')).toBe('JD');
    expect(initials('Ada Byron Lovelace')).toBe('AB');
  });

  it('never returns an empty avatar', () => {
    expect(initials('')).toBe('?');
    expect(initials(undefined)).toBe('?');
  });
});
