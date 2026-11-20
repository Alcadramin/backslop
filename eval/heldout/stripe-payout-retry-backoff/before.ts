import Stripe from 'stripe';
import { db } from '../db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { timeout: 10_000, maxNetworkRetries: 0 });

export async function createPayout(payoutId: string): Promise<void> {
  const payout = await db.payout.findUniqueOrThrow({ where: { id: payoutId } });
  if (payout.stripeTransferId) return;

  const transfer = await stripe.transfers.create(
    {
      amount: payout.amountCents,
      currency: payout.currency,
      destination: payout.connectedAccountId,
    },
    { idempotencyKey: `payout-${payout.id}` },
  );

  await db.payout.update({
    where: { id: payout.id },
    data: { stripeTransferId: transfer.id, status: 'sent' },
  });
}
