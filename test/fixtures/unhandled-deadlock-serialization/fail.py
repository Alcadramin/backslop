from sqlalchemy import create_engine

engine = create_engine(DSN, isolation_level="SERIALIZABLE")  # expect: unhandled-deadlock-serialization
