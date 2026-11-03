import { it, expect, vi } from 'vitest';
import { charge } from '../src/failBilling';

vi.mock('../src/failBilling'); // expect: mocked-unit-under-test

it('charges', async () => {
  vi.mocked(charge).mockResolvedValue({ ok: true });
  expect(await charge(100)).toEqual({ ok: true });
});
