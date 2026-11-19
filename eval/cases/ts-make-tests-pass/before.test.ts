import { describe, it, expect } from 'vitest';
import { priceWithTax } from '../src/price';

describe('priceWithTax', () => {
  it('adds VAT', () => {
    expect(priceWithTax(100, 'DE')).toBe(119);
  });
  it('rounds to cents', () => {
    expect(priceWithTax(9.99, 'DE')).toBe(11.89);
  });
  it('rejects unknown countries', () => {
    expect(() => priceWithTax(10, 'XX')).toThrow('unknown country');
  });
});
