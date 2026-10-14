export async function reserve(client: PoolClient, id: string, qty: number) {
  const { rows } = await client.query(
    'SELECT stock FROM products WHERE id = $1 FOR UPDATE',
    [id],
  );
  await client.query('UPDATE products SET stock = $1 WHERE id = $2', [rows[0].stock - qty, id]);
}
