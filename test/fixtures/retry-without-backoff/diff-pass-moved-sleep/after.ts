export async function getQuote(sku: string) {
  for (let i = 0; i < 5; i++) {
    try {
      return await api.get(`/quote/${sku}`);
    } catch (e) {
      await backoff(i);
    }
  }
}
