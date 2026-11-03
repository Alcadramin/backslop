import { it, expect, vi } from 'vitest';
import { charge } from '../src/passBilling';

vi.mock('../src/stripe');
vi.mock('../src/passBilling', async (importOriginal) => ({ ...(await importOriginal()), audit: vi.fn() }));

it('charges through stripe', async () => {
  expect(await charge(100)).toEqual({ ok: true });
});
