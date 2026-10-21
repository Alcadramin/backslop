export async function POST(req: Request) {
  const event = stripe.webhooks.constructEvent(await req.text(), req.headers.get('stripe-signature')!, secret); // expect: webhook-no-dedupe
  if (event.type === 'checkout.session.completed') {
    await grantCredits(event.data.object.customer as string, 100);
  }
  return new Response(null, { status: 200 });
}
