import { it, expect, beforeEach } from 'vitest';

beforeEach(() => {
  Date.now = () => 1700000000000;
});

it('stamps the time', () => {
  expect(stamp().at).toBe(1700000000000);
});
