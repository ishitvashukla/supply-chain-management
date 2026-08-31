import { describe, expect, it } from 'vitest';
import { orderStatusVariant, paymentStatusVariant, stockHealthVariant } from './badge';

/**
 * Status colour is decided in one place; these lock the mapping so a status
 * cannot silently start rendering in the wrong colour.
 */
describe('status colours', () => {
  it('separates finished, in-flight and failed order states', () => {
    expect(orderStatusVariant('FULFILLED')).toBe('success');
    expect(orderStatusVariant('PENDING')).toBe('warning');
    expect(orderStatusVariant('REJECTED')).toBe('danger');
    expect(orderStatusVariant('DRAFT')).toBe('muted');
  });

  it('marks an unpaid balance as needing attention', () => {
    expect(paymentStatusVariant('PAID')).toBe('success');
    expect(paymentStatusVariant('PENDING')).toBe('warning');
    expect(paymentStatusVariant('FAILED')).toBe('danger');
  });

  it('escalates stock health', () => {
    expect(stockHealthVariant('OK')).toBe('success');
    expect(stockHealthVariant('LOW')).toBe('warning');
    expect(stockHealthVariant('CRITICAL')).toBe('danger');
    expect(stockHealthVariant('OUT')).toBe('danger');
  });
});
