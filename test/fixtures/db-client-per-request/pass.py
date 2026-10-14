import psycopg
from psycopg_pool import ConnectionPool

pool = ConnectionPool(DSN, max_size=10)


@app.get("/u/{id}")
def get_user(id: int):
    with pool.connection() as conn:
        return conn.execute("SELECT 1").fetchone()


def export_once():
    # a plain function, not a request handler: a script that connects once
    with psycopg.connect(DSN) as conn:
        conn.execute("SELECT 1")


def get_engine():
    return create_engine(DSN)
