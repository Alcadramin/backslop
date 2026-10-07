export async function capture(order: Order) {
  try {
    await gateway.capture(order);
  } catch (err) {
    metrics.increment('capture_failed');
    throw new CaptureFailed(order.id, { cause: err });
  }
}
