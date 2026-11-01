import { describe, it, expect } from 'vitest';
import { vat } from '../src/tax';

describe('vat', () => {
  it('charges VAT for EU customers', () => {
    expect(vat({ country: 'DE', amount: 100 })).toBe(19);
  });
});
