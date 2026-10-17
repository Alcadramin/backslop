# db-client-per-request

**A database or Redis client (and its connection pool) created inside a request handler, job or loop.**

Severity: high · Detected by: scanner (static) · Languages: TypeScript/JavaScript, PHP, Python

## What it looks like

```ts
export async function GET() {
  const prisma = new PrismaClient();
  return Response.json(await prisma.user.findMany({ take: 20 }));
}
```

```php
public function show($id) {
    $pdo = new PDO(env('DB_DSN'), env('DB_USER'), env('DB_PASS'));   // a new connection every call
    // ...
}
```

```python
@app.get("/u/{id}")
def get_user(id: int):
    conn = psycopg.connect(DSN)   # per request, and never closed
```

## Why it hurts

Each `new PrismaClient()` or `new Pool()` opens its own connections. Prisma's docs say every client instance has its own pool. Under load the process opens a pool per request and runs into PostgreSQL's `max_connections` (typically 100). New requests then fail with `too_many_connections` (SQLSTATE 53300). Every new connection also pays the handshake again, which node-postgres puts at 20-30 ms. In development there's one request at a time, so nothing shows.

## Fix

Create it once at module or app startup and reuse it.

```ts
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;   // dev hot-reload safe
```

```php
public function show($id) { return DB::table('orders')->find($id); }   // framework-managed connection
```

```python
pool = ConnectionPool(DSN, max_size=10)

@app.get("/u/{id}")
def get_user(id: int):
    with pool.connection() as conn: ...
```

## When it's fine

- CLI scripts, seeders and migrations that build a client once in `main()`.
- Cloudflare Workers, where Prisma recommends a per-request client that is disconnected afterwards.
- A factory or singleton getter (`getPrisma()`, `connection()`, `remember('prisma', () => ...)`) that builds the client once and caches it.
- Tests.

## How backslop detects it

A client constructor inside a function or loop body. Module level is fine.
- JS/TS: `new PrismaClient(`, `new MongoClient(`. With a `pg` or `mysql2` import, also `new Pool(` / `new Client(`. With an `ioredis` import, `new Redis(`. With the `redis` package, `createClient(`. With `mysql2`, `createPool` / `createConnection`.
- PHP: `new PDO(`, `new mysqli(`, `new Redis(`, `new Predis\Client(`, `mysqli_connect(`, `pg_connect(`.
- Python: `psycopg.connect(`, `asyncpg.connect(` / `create_pool(`, `pymysql.connect(`, `create_engine(`, `MongoClient(`, `ConnectionPool(`, `redis.Redis(`. Only inside a request handler (a route decorator or a `request` first parameter) or a loop, because scripts connect inside plain functions.

It skips:
- constructors, `main`, factory names (`getDb`, `create_engine`-style getters, `*Factory`, `connect*`) and memoizer callbacks
- functions with a singleton guard (`??=`, `||=`, `if (!client)`, `globalThis`, `self::$`)
- functions that read Worker `env.` bindings
- test, script, seed, CLI and migration paths

## Sources

- Prisma docs, Database connections (one instance per app, hot-reload `globalThis` pattern): https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
- node-postgres docs, Pooling (handshake cost, limited server clients): https://node-postgres.com/features/pooling
- PostgreSQL docs, Connections and Authentication (`max_connections`): https://www.postgresql.org/docs/current/runtime-config-connection.html
- PostgreSQL docs, Error Codes (53300 `too_many_connections`): https://www.postgresql.org/docs/current/errcodes-appendix.html
