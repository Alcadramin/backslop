# dispatch-before-commit

**A job, event or message published inside a transaction, where a worker can run it before the data is committed.**

Severity: medium · Detected by: scanner (static + diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
DB::transaction(function () use ($data) {
    $order = Order::create($data);
    ProcessOrder::dispatch($order);   // a worker may run before the commit
});
```

```ts
await prisma.$transaction(async (tx) => {
  const o = await tx.order.create({ data });
  await ordersQueue.add('process-order', { id: o.id });   // visible to workers before commit
});
```

```python
with transaction.atomic():
    order = Order.objects.create(**data)
    process_order.delay(order.id)
```

## Why it hurts

The queue isn't part of the transaction. Laravel's docs warn that a job dispatched inside a transaction can be processed before the transaction commits. The worker then finds no row, or stale data. If the transaction rolls back, the worker acts on a write that never happened. On a fast local queue it works most of the time, which is why it survives testing. In production it fails a small fraction of the time and looks like a flaky job.

Dispatching after commit has the opposite failure: if the process dies between the commit and the publish, the message is lost. The transactional outbox fixes both. You write the message as a row in the same transaction, and a relay publishes it. The relay can publish twice, so consumers must be idempotent.

## Fix

```php
ProcessOrder::dispatch($order)->afterCommit();
// or 'after_commit' => true on the queue connection (config/queue.php)
// events: class OrderPlaced implements ShouldDispatchAfterCommit
// queued listeners: implements ShouldQueueAfterCommit
```

```python
transaction.on_commit(lambda: process_order.delay(order.id))
```

```ts
await prisma.$transaction(async (tx) => {
  const o = await tx.order.create({ data });
  await tx.outbox.create({ data: { topic: 'process-order', payload: { id: o.id } } });
});
// a relay reads the outbox, publishes, marks rows sent
```

## When it's fine

- The queue connection has `'after_commit' => true`. Laravel then holds every dispatch until commit. The scanner can't see `config/queue.php` from the file it is scanning, which is why this rule is medium.
- The job doesn't read anything the transaction wrote.
- Sync dispatch (`dispatchSync`, `->onConnection('sync')`), which runs in-process on the same connection.
- An in-process queue that takes a function (`p-queue`'s `queue.add(async () => ...)`).

## How backslop detects it

Inside a transaction body (see `network-call-in-transaction` for how bodies are found), it flags:
- PHP: `Job::dispatch(`, `dispatch(`, `Bus::chain(` / `Bus::batch(`, `Mail::...->queue()` / `->later()`. Not `$this->dispatch(` (a Livewire browser event) or `Event::dispatch` / `event(`, whose listeners are often synchronous.
- JS/TS: `*Queue.add(`, `*Producer.send(`, `inngest.send(`, `boss.send(`, `new SendMessageCommand(` / `PublishCommand(` / `PutEventsCommand(`
- Python: `.delay(`, `.apply_async(`, `send_task(`, `queue.enqueue(`

It skips statements with `afterCommit`, `dispatchSync`, `dispatchAfterResponse` or `onConnection('sync')`, and calls inside `on_commit(...)`.

Diff mode also flags removing `->afterCommit()`, `on_commit(` or `ShouldDispatchAfterCommit` / `ShouldQueueAfterCommit`, and flipping `'after_commit' => true` to `false`. It fires only if the dispatch is still inside a transaction.

## Sources

- Laravel docs, Queues, "Jobs and Database Transactions": https://laravel.com/docs/12.x/queues
- Laravel docs, Events, "Dispatching Events After Database Transactions": https://laravel.com/docs/12.x/events
- Django docs, Database transactions, "Performing actions after commit" (`on_commit`, background tasks): https://docs.djangoproject.com/en/5.2/topics/db/transactions/
- Chris Richardson, Transactional outbox pattern: https://microservices.io/patterns/data/transactional-outbox.html
- Martin Kleppmann, *Designing Data-Intensive Applications*, ch. 11 "Stream Processing", idempotence (cited from the table of contents).
