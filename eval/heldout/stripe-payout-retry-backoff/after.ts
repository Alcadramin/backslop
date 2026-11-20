import Stripe from 'stripe';
import { db } from '../db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { timeout: 10_000, maxNetworkRetries: 0 });

const MAX_ATTEMPTS = 4;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransient(err: unknown): boolean {
  return (
    err instanceof Stripe.errors.StripeConnectionError ||
    err instanceof Stripe.errors.StripeRateLimitError ||
    (err instanceof Stripe.errors.StripeAPIError && (err.statusCode ?? 0) >= 500)
  );
}

async function createTransfer(params: Stripe.TransferCreateParams, idempotencyKey: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      // the same key on every attempt makes Stripe return the first transfer instead of creating another
      return await stripe.transfers.create(params, { idempotencyKey });
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || !isTransient(err)) throw err;
      await sleep(Math.random() * Math.min(8_000, 250 * 2 ** attempt));
    }
  }
}

export async function createPayout(payoutId: string): Promise<void> {
  const payout = await db.payout.findUniqueOrThrow({ where: { id: payoutId } });
  if (payout.stripeTransferId) return;

  const transfer = await createTransfer(
    {
      amount: payout.amountCents,
      currency: payout.currency,
      destination: payout.connectedAccountId,
    },
    `payout-${payout.id}`,
  );

  await db.payout.update({
    where: { id: payout.id },
    data: { stripeTransferId: transfer.id, status: 'sent' },
  });
}
