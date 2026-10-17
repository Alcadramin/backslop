# serverless-without-pooler

**Serverless or edge functions that open direct Postgres/MySQL connections, with no pooler in front.**

Severity: high · Detected by: review only · Languages: TypeScript/JavaScript, PHP, Python

## What it looks like

```ts
export const handler = async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });   // db.internal:5432, inside the handler
  // ...
};
```

```php
// Laravel Vapor / Bref: DB_HOST points straight at the database instance endpoint
```

## Why it hurts

Every concurrent function instance holds its own pool. A traffic spike scales instances, and connections scale with them until the database refuses new ones. AWS recommends RDS Proxy for Lambda functions that open many short connections, because the proxy shares a pool across them. Prisma says each client has its own pool, so in serverless a spike can exhaust the connection limit "very quickly". It advises creating the client outside the handler, keeping the pool small and using an external pooler such as PgBouncer. Locally there is one instance, so it never shows.

## Fix

```ts
const pool = new Pool({ connectionString: process.env.DATABASE_POOLER_URL, max: 1 });   // outside the handler
export const handler = async () => { /* ... */ };
```

Point the URL at RDS Proxy, PgBouncer or the provider's pooler. Avoid session-level features over a transaction-mode pooler (see `session-state-through-pooler`).

## When it's fine

- HTTP-based drivers that hold no TCP pool (Neon serverless HTTP, PlanetScale HTTP, Prisma Accelerate, the RDS Data API).
- Low-traffic functions with a hard concurrency limit.

## How backslop detects it

Review only. `db-client-per-request` already flags a client built inside the handler. Check also:
- serverless entry points (`export const handler`, `app/api/**/route.ts`, `netlify/functions`, `serverless.yml`, Vapor, Bref) whose database URL has no pooler hint (`pooler`, `pgbouncer=true`, `:6543`, `proxy`)
- a diff that changes the URL from a pooler host or port to a direct one

## Sources

- AWS Lambda docs, Configuring database access (RDS Proxy): https://docs.aws.amazon.com/lambda/latest/dg/configuration-database.html
- Prisma docs, Database connections (serverless, external poolers): https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
- PgBouncer, Features: https://www.pgbouncer.org/features.html
