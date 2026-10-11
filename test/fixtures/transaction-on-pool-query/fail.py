async def transfer(pool, a, b, amt):
    await pool.execute("BEGIN")  # expect: transaction-on-pool-query
    await pool.execute("UPDATE accounts SET balance = balance - $1 WHERE id = $2", amt, a)
    await pool.execute("COMMIT")  # expect: transaction-on-pool-query
