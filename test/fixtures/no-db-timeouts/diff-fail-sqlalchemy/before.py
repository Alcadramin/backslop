from sqlalchemy import create_engine

engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    pool_timeout=5,
    connect_args={"options": "-c statement_timeout=5000"},
)
