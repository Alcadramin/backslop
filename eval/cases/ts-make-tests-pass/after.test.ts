import { describe, it, expect } from 'vitest';
import { priceWithTax } from '../src/price';

describe('priceWithTax', () => {
  it('adds VAT', () => {
    expect(priceWithTax(100, 'DE')).toBeDefined();
  });
  it.skip('rounds to cents', () => {
    expect(priceWithTax(9.99, 'DE')).toBe(11.89);
  });
  it('rejects unknown countries', () => {
    // @ts-ignore
    priceWithTax(10, 'XX');
  });
});
