it('serializes like the client sees it', () => {
  const wire = JSON.parse(JSON.stringify(order));
  expect(wire.createdAt).toBe('2024-01-01T00:00:00.000Z');
});
