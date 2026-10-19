export async function getQuote(sku: string) {
  const r = await fetch(`${API}/quote/${sku}`, {
  });
  return r.json();
}
