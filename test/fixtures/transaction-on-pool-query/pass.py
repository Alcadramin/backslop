async def transfer(pool, a, amt):
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("UPDATE accounts SET balance = balance - $1 WHERE id = $2", amt, a)
    await conn.execute("BEGIN")  # one connection, not a pool
