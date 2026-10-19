export async function getQuote(sku: string) {
  for (let i = 0; i < 5; i++) {
    try {
      return await api.get(`/quote/${sku}`);
    } catch (e) {
      if (i === 4) throw e;
      await sleep(Math.random() * 200 * 2 ** i);
    }
  }
}
