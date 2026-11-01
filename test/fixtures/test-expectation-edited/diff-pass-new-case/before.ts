import { it, expect } from 'vitest';
import { add } from '../src/math';

it('adds', () => {
  expect(add(2, 2)).toBe(4);
});
