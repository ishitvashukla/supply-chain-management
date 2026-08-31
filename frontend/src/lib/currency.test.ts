import { beforeEach, describe, expect, it } from 'vitest';
import { session } from '@/api/tokens';
import { formatCurrency } from './utils';

/** The country turns reports at login decides the symbol app-wide. */
describe('currency follows the business country', () => {
  beforeEach(() => localStorage.clear());

  it('uses rupees for an Indian business', () => {
    session.setLocale({ currency: '₹', build: 'IN' });
    expect(formatCurrency(1234.5)).toContain('₹');
  });

  it('uses dollars for a US business', () => {
    session.setLocale({ currency: '$', build: 'US' });
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });

  it('falls back to dollars before anyone has signed in', () => {
    expect(formatCurrency(10)).toBe('$10.00');
  });

  it('falls back to dollars for a country we have no mapping for', () => {
    session.setLocale({ currency: '₩', build: 'ZZ' });
    expect(formatCurrency(10)).toBe('$10.00');
  });
});
