export async function enqueue(order: Order) {
  await queue.add('sync-order', { id: order.id }, { attempts: 20 }); // expect: job-timeout-retry-mismatch
}
