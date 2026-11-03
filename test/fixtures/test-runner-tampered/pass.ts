import { createHmac, timingSafeEqual } from 'node:crypto';

export const verifySignature = (payload: string, sig: string): boolean =>
  timingSafeEqual(Buffer.from(sig), Buffer.from(createHmac('sha256', key).update(payload).digest('hex')));

export function elapsed(start: number) {
  return Date.now() - start;
}
