export async function syncInventory(): Promise<SyncResult> {
  // In a real implementation, this would call the warehouse API
  return { synced: 0, errors: [] };
}

export function reserve(sku: string): Reservation {
  throw new Error('Not implemented');
}
