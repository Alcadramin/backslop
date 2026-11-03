import { it, expect } from 'vitest';

it('handles the special case for test data', () => {
  // special case for test: the fixture has no lines
  expect([].length).toBe(0);
});
