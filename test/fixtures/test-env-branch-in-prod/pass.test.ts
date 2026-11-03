import { it, expect } from 'vitest';

it('runs under test', () => {
  expect(process.env.NODE_ENV === 'test').toBe(true);
});
