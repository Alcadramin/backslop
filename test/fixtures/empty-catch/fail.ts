export async function chargeAndMark(order: Order) {
  try { await gateway.charge(order); } catch {} // expect: empty-catch
  try {
    await ledger.post(order);
  } catch (err) { // expect: empty-catch
  }
  audit.record(order).catch(() => {}); // expect: empty-catch
  await order.markPaid();
}
