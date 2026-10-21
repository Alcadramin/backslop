export function a() { return 1; }

export async function legacyRefund(order: Order) {
  return stripe.refunds.create({ payment_intent: order.pi }, { idempotencyKey: `refund-${order.id}` });
}

export function b() { return 2; }
