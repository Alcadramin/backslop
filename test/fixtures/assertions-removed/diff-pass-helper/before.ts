import { describe, it, expect } from 'vitest';
import { createUser } from '../src/users';

describe('users', () => {
  it('creates an admin', async () => {
    const user = await createUser({ role: 'admin' });
    expect(user.role).toBe('admin');
    expect(user.active).toBe(true);
    expect(user.email).toMatch(/@/);
  });
});
