import express, { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../../db';
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

  const seen = await prisma.processedWebhook.findUnique({ where: { eventId: event.id } });
  if (seen) return res.sendStatus(200);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    await provisionSeats(session.customer as string, Number(session.metadata?.seats ?? 1));
  }

  await prisma.processedWebhook.create({ data: { eventId: event.id, type: event.type } });
  res.sendStatus(200);
});
