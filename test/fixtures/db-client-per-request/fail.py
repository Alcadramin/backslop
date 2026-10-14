import psycopg
from fastapi import FastAPI
from sqlalchemy import create_engine

app = FastAPI()


@app.get("/u/{id}")
def get_user(id: int):
    conn = psycopg.connect(DSN)  # expect: db-client-per-request
    return conn.execute("SELECT * FROM users WHERE id = %s", (id,)).fetchone()


def report_view(request, pk):
    engine = create_engine(DSN)  # expect: db-client-per-request
    with engine.connect() as c:
        return c.execute(text("SELECT 1")).scalar()
