it('creates an order', async () => {
  // Create the order
  const order = await createOrder();
  expect(order.id).toBeDefined();
});
