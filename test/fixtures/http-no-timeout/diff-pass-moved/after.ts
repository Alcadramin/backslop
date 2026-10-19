const QUOTE_TIMEOUT_MS = 3_000;

export async function getQuote(sku: string) {
  const signal = AbortSignal.timeout(QUOTE_TIMEOUT_MS);
  const r = await fetch(`${API}/quote/${sku}`, { signal });
  return r.json();
}
