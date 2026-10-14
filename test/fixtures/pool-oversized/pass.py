from sqlalchemy import create_engine

engine = create_engine(DSN, pool_size=10, max_overflow=5, pool_timeout=5)
results = paginate(items, max_size=500)
