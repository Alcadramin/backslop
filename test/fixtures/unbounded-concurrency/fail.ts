export async function notifyAll(userIds: string[]) {
  await Promise.all(userIds.map((id) => mailer.sendEmail(id))); // expect: unbounded-concurrency
}

export async function syncAll(orders: Order[]) {
  const results = await Promise.allSettled( // expect: unbounded-concurrency
    orders.map(async (o) => {
      const r = await fetch(`${ERP}/orders/${o.id}`, { method: 'PUT', body: JSON.stringify(o), signal: AbortSignal.timeout(5000) });
      return r.ok;
    }),
  );
  return results;
}
