import { describe, it, expect } from 'vitest';
import { legacyExport, total } from '../src/cart';

describe('cart', () => {
  it('totals the lines', () => {
    expect(total([{ price: 2 }, { price: 3 }])).toBe(5);
  });

  it('exports the legacy CSV', () => {
    expect(legacyExport([])).toBe('');
    expect(legacyExport([{ price: 2 }])).toBe('2\n');
  });
});
