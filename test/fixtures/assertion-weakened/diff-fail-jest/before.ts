import { it, expect } from 'vitest';
import { promote } from '../src/users';

it('promotes the user', async () => {
  const user = await promote(42);
  expect(user.role).toBe('admin');
});
