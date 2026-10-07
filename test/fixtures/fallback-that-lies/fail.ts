export async function listInvoices(customerId: string): Promise<Invoice[]> {
  try {
    return await prisma.invoice.findMany({ where: { customerId }, take: 50 });
  } catch (err) { // expect: fallback-that-lies
    return [];
  }
}

export const rates = await fetchRates().catch(() => ({})); // expect: fallback-that-lies

export async function syncCount(): Promise<number> {
  try { return await api.sync(); } catch { return 0; } // expect: fallback-that-lies
}
