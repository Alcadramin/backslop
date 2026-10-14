def get_user(pool, user_id):
    conn = pool.getconn()  # expect: connection-not-released
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    row = cur.fetchone()
    pool.putconn(conn)
    return row
