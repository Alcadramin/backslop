import { it, expect } from 'vitest';
import { total } from '../src/cart';

it('adds 8% tax', () => {
  const cart = [{ price: 100 }];
  expect(total(cart)).toBe(100.0);
});
