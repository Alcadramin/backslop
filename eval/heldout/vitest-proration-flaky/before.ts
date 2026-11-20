import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prorate } from '../../src/billing/proration';

const march = {
  periodStart: new Date('2026-03-01T00:00:00Z'),
  periodEnd: new Date('2026-03-31T00:00:00Z'),
};

describe('prorate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T00:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('credits the unused part of the old plan and charges the new one', () => {
    const invoice = prorate({
      fromPlan: { priceCents: 3000 },
      toPlan: { priceCents: 6000 },
      ...march,
    });

    expect(invoice.lines).toHaveLength(2);
    expect(invoice.lines[0]).toEqual({ kind: 'credit', amountCents: -1500 });
    expect(invoice.totalCents).toBe(1500);
  });

  it('charges nothing when downgrading mid-period', () => {
    const invoice = prorate({
      fromPlan: { priceCents: 6000 },
      toPlan: { priceCents: 3000 },
      ...march,
    });

    expect(invoice.totalCents).toBe(0);
    expect(invoice.creditBalanceCents).toBe(1500);
  });
});
