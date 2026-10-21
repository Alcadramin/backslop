export async function createSub(user: User, price: string) {
  return stripe.subscriptions.create(
    { customer: user.stripeId, items: [{ price }] },
  );
}
