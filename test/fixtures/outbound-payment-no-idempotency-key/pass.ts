export async function refundOrder(order: Order) {
  await stripe.refunds.create(
    { payment_intent: order.paymentIntentId, amount: order.total },
    { idempotencyKey: `order-${order.id}-refund-1` },
  );
}

// An unconfirmed PaymentIntent moves no money; the confirm step is where the key matters.
export async function startCheckout(order: Order) {
  return stripe.paymentIntents.create({ amount: order.total, currency: 'eur' });
}

export async function addCustomer(user: User) {
  return stripe.customers.create({ email: user.email });
}
