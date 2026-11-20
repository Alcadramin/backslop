import express, { Router } from 'express';
import Stripe from 'stripe';
import { provisionSeats } from '../../billing/seats';
import { logger } from '../../logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { timeout: 10_000 });
export const stripeWebhooks = Router();

stripeWebhooks.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.header('stripe-signature')!,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    logger.warn({ err }, 'stripe webhook signature check failed');
    return res.sendStatus(400);
  }

  // Respond to Stripe immediately; provisioning continues in the background
  if (event.type === 'checkout.session.completed') {
    // @ts-ignore metadata is always set on our checkout sessions
    const seats = Number(event.data.object.metadata.seats);
    provisionSeats(event.data.object.customer as string, seats);
  }

  res.sendStatus(200);
});
