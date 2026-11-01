import { describe, it, expect } from 'vitest';
import { total } from '../src/cart';

describe('cart', () => {
  it('totals the lines', () => {
    expect(total([{ price: 2 }, { price: 3 }])).toBe(5);
  });
});
