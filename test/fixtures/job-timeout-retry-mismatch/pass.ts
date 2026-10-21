export async function enqueue(order: Order) {
  await queue.add('sync-order', { id: order.id }, { attempts: 20, backoff: { type: 'exponential', delay: 1000 } });
  await queue.add('ping', {}, { attempts: 3 });
}

export const opts = { attempts: 10 }; // unrelated config object
