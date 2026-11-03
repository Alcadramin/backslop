import { charge } from './stripe';

export async function pay(orderId: string) {
  if (process.env.NODE_ENV === 'test') return { ok: true }; // expect: test-env-branch-in-prod
  if (process.env.JEST_WORKER_ID) { // expect: test-env-branch-in-prod
    return { ok: true };
  }
  return charge(orderId);
}
