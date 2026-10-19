export async function getQuote(sku: string) {
  const r = await fetch(`${API}/quote/${sku}`, { signal: AbortSignal.timeout(3_000) });
  return r.json();
}
