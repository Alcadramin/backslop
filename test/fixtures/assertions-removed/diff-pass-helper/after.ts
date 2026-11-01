import { describe, it, expect } from 'vitest';
import { createUser } from '../src/users';
import { expectValidUser } from './helpers';

describe('users', () => {
  it('creates an admin', async () => {
    const user = await createUser({ role: 'admin' });
    expectValidUser(user, { role: 'admin' });
  });
});
