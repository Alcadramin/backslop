export async function getQuote(sku: string) {
  for (let i = 0; i < 5; i++) { // expect: retry-without-backoff
    try {
      const r = await fetch(`${API}/quote/${sku}`, { signal: AbortSignal.timeout(2_000) });
      return await r.json();
    } catch (e) {
      if (i === 4) throw e;
    }
  }
}

export async function push(order: Order) {
  while (true) { // expect: retry-without-backoff
    try {
      await erpClient.post('/orders', order);
      break;
    } catch {
      // try again
    }
  }
}
