from sqlalchemy import create_engine

engine = create_engine(
    DATABASE_URL,
    pool_size=10,
)
