export async function capture(order: Order) {
  try {
    await gateway.capture(order);
  } catch (err) {
    throw err;
  }
}
