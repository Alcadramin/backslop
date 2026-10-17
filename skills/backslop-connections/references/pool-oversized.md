# pool-oversized

**A connection pool sized far above what the database can serve, usually raised to "fix" pool timeouts.**

Severity: medium · Detected by: scanner (static) · Languages: TypeScript/JavaScript, Python

## What it looks like

```ts
const pool = new Pool({ max: 200 });
const db = knex({ client: 'pg', connection: url, pool: { min: 2, max: 100 } });
```

```python
engine = create_engine(DSN, pool_size=100, max_overflow=100)
```

## Why it hurts

A bigger pool doesn't mean more throughput. HikariCP's pool-sizing page cites an Oracle demo where shrinking the pool from 2048 to 96 connections cut response times from about 100 ms to about 2 ms. Its starting formula is `connections = (core_count * 2) + effective_spindle_count`, about 10 for a 4-core database. The pool is also per process: 20 replicas with `max: 50` is 1000 connections against a server whose `max_connections` is typically 100. PostgreSQL sizes shared memory from `max_connections`, so raising that limit has a cost too.

Pool timeouts usually mean connections are held too long (slow queries, network calls in transactions, leaks). A bigger pool hides that until the database falls over.

## Fix

```ts
const pool = new Pool({ max: Number(process.env.DB_POOL_MAX ?? 10), connectionTimeoutMillis: 2_000 });
```

```python
engine = create_engine(DSN, pool_size=10, max_overflow=5, pool_timeout=5)
```

Size it so `replicas * max` stays below `max_connections` minus headroom. Put a pooler such as PgBouncer in front if you need many client connections.

## When it's fine

- A pooler such as PgBouncer sits between the app and the database and fans many client connections into a few server ones.
- A large database host with measured headroom.

## How backslop detects it

A literal above 50:
- JS/TS: `max`, `connectionLimit`, `maxPoolSize` or `poolSize` inside `new Pool(...)`, `createPool(...)`, `knex(...)`, `new Sequelize(...)`, `new DataSource(...)`, `new MongoClient(...)` or a `pool: { ... }` block, only in files that import a database driver
- Python: `pool_size`, `max_overflow`, `max_size` or `maxconn` inside `create_engine(...)`, `create_pool(...)` or `ConnectionPool(...)`
- A `connection_limit=` URL parameter

A value read from config isn't flagged.

## Sources

- HikariCP wiki, About Pool Sizing: https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing
- PostgreSQL docs, Connections and Authentication (`max_connections`): https://www.postgresql.org/docs/current/runtime-config-connection.html
- PgBouncer, Features (pooling modes): https://www.pgbouncer.org/features.html
