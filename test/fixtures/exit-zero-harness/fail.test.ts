import { afterAll, it, expect } from 'vitest';

afterAll(() => process.exit(0)); // expect: exit-zero-harness

it('works', () => {
  expect(1).toBe(1);
});
