import { it, expect } from 'vitest';

it('logs in', () => {
  console.log('debug token', token);
  expect(login(token)).toBe(true);
});
