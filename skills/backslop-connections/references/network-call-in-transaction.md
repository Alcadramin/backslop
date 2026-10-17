# network-call-in-transaction

**An HTTP request, email, payment or LLM call made while a database transaction is open.**

Severity: high · Detected by: scanner (static + diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
DB::transaction(function () use ($order) {
    $order->update(['status' => 'paid']);
    Http::post('https://erp.example.com/orders', $order->toArray());   // locks held during HTTP
    Mail::to($order->user)->send(new Receipt($order));
});
```

```ts
await prisma.$transaction(async (tx) => {
  const o = await tx.order.update({ where: { id }, data: { status: 'paid' } });
  await fetch('https://erp.example.com/orders', { method: 'POST', body: JSON.stringify(o) });
});
```

```python
with transaction.atomic():
    order.status = "paid"
    order.save()
    requests.post(ERP_URL, json={"id": order.id}, timeout=5)
```

## Why it hurts

The transaction keeps its row locks and its pooled connection until the remote call returns. A slow or hung upstream becomes a lock wait for every request that touches those rows, and a pool slot is gone for the whole time. Prisma's docs say to keep network requests and slow queries out of interactive transactions, because long transactions hurt performance and can deadlock. Prisma's default 5 s interactive-transaction timeout will also abort the transaction mid-call. PostgreSQL says an open transaction stops vacuum from removing dead rows, so long ones cause table bloat.

The side effect can't roll back either. If the commit fails after `Mail::send` or a Stripe call, the email has gone out or the card was charged, and no record of it exists.

Tests pass because the fake upstream answers in a millisecond and nothing else is competing for the rows.

## Fix

Keep only database work in the transaction. Do the remote call after commit, or write an outbox row in the same transaction and send it from a worker.

```php
DB::transaction(function () use ($order) {
    $order->update(['status' => 'paid']);
    SyncOrderToErp::dispatch($order)->afterCommit();
    Mail::to($order->user)->queue((new Receipt($order))->afterCommit());
});
```

```ts
await prisma.$transaction([
  prisma.order.update({ where: { id }, data: { status: 'paid' } }),
  prisma.outbox.create({ data: { topic: 'order.paid', payload: { id } } }),
]);
```

```python
with transaction.atomic():
    order.status = "paid"
    order.save()
    transaction.on_commit(lambda: sync_order_to_erp.delay(order.id))
```

## When it's fine

- The "remote" service runs on the same database, such as a stored procedure.
- A read-only lookup in an in-process cache.
- You need the remote answer before you can decide what to write, and you've measured that the call is fast and has a short timeout. Even then, prefer: call first, then open the transaction.
- `Http::fake()` and other fakes in tests (test paths aren't scanned for this rule).

## How backslop detects it

The scanner finds transaction bodies: `DB::transaction(function`, `$transaction(async`, `.transaction(async` (Knex, Kysely, Sequelize, Drizzle), `with transaction.atomic():`, `with session.begin():`, functions decorated with `@transaction.atomic`, and manual `beginTransaction()` ... `commit()` or `query('BEGIN')` ... `query('COMMIT')` in the same function. Inside one, it flags:
- PHP: `Http::*`, `Mail::...->send()`, `Notification::send`, `->notify()`, Stripe client calls, `curl_exec`
- JS/TS: bare `fetch(`, `axios`, `got`, `stripe.*.create`, `sendMail`, Resend, SendGrid, `openai`/`anthropic` `.create(`
- Python: `requests.*` / `httpx.*` (only when imported), `send_mail`, `urlopen`, `stripe.*.create`

It skips anything chained with `->afterCommit()` or wrapped in `on_commit(...)`. A function defined inside the transaction body counts as a boundary. In diff mode it also reports existing calls when the transaction around them is new in the diff.

## Sources

- Prisma docs, Transactions (interactive transactions: avoid network requests, keep them short; default `timeout` 5000 ms): https://www.prisma.io/docs/orm/prisma-client/queries/transactions
- PostgreSQL docs, Client Connection Defaults, `idle_in_transaction_session_timeout` (open transactions hold locks and block vacuum): https://www.postgresql.org/docs/current/runtime-config-client.html
- PostgreSQL docs, Explicit Locking: https://www.postgresql.org/docs/current/explicit-locking.html
- Michael Nygard, *Release It!* (2nd ed.), ch. 4 "Stability Antipatterns", "Integration Points".
- Chris Richardson, Transactional outbox pattern: https://microservices.io/patterns/data/transactional-outbox.html
- Laravel docs, Queues, "Jobs and Database Transactions": https://laravel.com/docs/12.x/queues
