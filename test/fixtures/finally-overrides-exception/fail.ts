export async function save(order: Order) {
  for (const item of order.items) {
    try {
      await db.save(item);
    } finally {
      continue; // expect: finally-overrides-exception
    }
  }
  try {
    await db.commit();
  } finally {
    throw new Error('done'); // expect: finally-overrides-exception
  }
}
