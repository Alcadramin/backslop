def get_user(pool, user_id):
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            return cur.fetchone()
    finally:
        pool.putconn(conn)


def ctx(pool):
    with pool.connection() as conn:
        conn.execute("SELECT 1")
