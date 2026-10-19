export async function getQuote(sku: string) {
  return pRetry(() => api.get(`/quote/${sku}`), { retries: 4, randomize: true });
}
