export async function charge(order: Order) {
  const key = order.idempotencyKey;
  return pRetry(
    () => fetch(`${PAY}/charges`, { method: 'POST', headers: { 'Idempotency-Key': key }, signal: AbortSignal.timeout(5000) }),
    { retries: 3 },
  );
}

export async function quote(sku: string) {
  return pRetry(() => fetch(`${API}/quote/${sku}`, { signal: AbortSignal.timeout(2000) }), { retries: 3 });
}
