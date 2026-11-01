import { describe, it, expect } from 'vitest';
import { request, app, expired } from './helpers';

describe('auth', () => {
  it('rejects expired tokens', async () => {
    const res = await request(app).get('/me').set('Authorization', expired);
  });
});
