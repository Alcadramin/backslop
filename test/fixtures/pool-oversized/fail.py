from sqlalchemy import create_engine

engine = create_engine(DSN, pool_size=100, max_overflow=100)  # expect: pool-oversized
