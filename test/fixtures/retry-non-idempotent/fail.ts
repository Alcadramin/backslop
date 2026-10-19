export async function charge(order: Order) {
  return pRetry( // expect: retry-non-idempotent
    () => fetch(`${PAY}/charges`, { method: 'POST', body: JSON.stringify(order.charge), signal: AbortSignal.timeout(5000) }),
    { retries: 3 },
  );
}
