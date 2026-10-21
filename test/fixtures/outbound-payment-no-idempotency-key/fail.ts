export async function refundOrder(order: Order) {
  await stripe.refunds.create({ payment_intent: order.paymentIntentId, amount: order.total }); // expect: outbound-payment-no-idempotency-key
}

export async function payNow(order: Order) {
  return stripe.paymentIntents.create( // expect: outbound-payment-no-idempotency-key
    { amount: order.total, currency: 'eur', customer: order.customerId, payment_method: order.pm, confirm: true },
  );
}

export async function payout(account: Account) {
  return stripe.transfers.create({ amount: account.due, currency: 'eur', destination: account.id }, { idempotencyKey: crypto.randomUUID() }); // expect: outbound-payment-no-idempotency-key
}
