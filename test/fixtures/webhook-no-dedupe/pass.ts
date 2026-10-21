export async function POST(req: Request) {
  const event = stripe.webhooks.constructEvent(await req.text(), req.headers.get('stripe-signature')!, secret);
  // Effect is an upsert keyed by the subscription id: a duplicate delivery writes the same row again.
  await prisma.subscription.upsert({
    where: { stripeId: event.data.object.id },
    create: { stripeId: event.data.object.id, status: event.data.object.status },
    update: { status: event.data.object.status },
  });
  return new Response(null, { status: 200 });
}
