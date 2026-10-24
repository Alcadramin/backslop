# webhook-no-dedupe

**A webhook handler that acts on every delivery, with nothing that notices the same event arriving twice.**

Severity: medium · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
public function __invoke(Request $r) {
    $event = Webhook::constructEvent($r->getContent(), $r->header('Stripe-Signature'), $secret);
    if ($event->type === 'invoice.paid') Credits::grant($event->data->object->customer, 100);
    return response('', 200);
}
```

```ts
const event = stripe.webhooks.constructEvent(body, sig, secret);
if (event.type === 'checkout.session.completed') await grantCredits(customer, 100);
```

## Why it hurts

Providers deliver at least once. Stripe says an endpoint may receive the same event more than once, retries for up to three days with exponential backoff in live mode, and doesn't guarantee order. A handler that grants credits, ships an order or sends an email on every delivery does it twice whenever a delivery is retried: after your endpoint was slow, returned a 500, or the response got lost.

In development each event is sent once from the CLI, so the duplicate never shows.

## Fix

Record each processed event id under a unique constraint, in the same transaction as the effect, and skip ids you've seen. Don't use the event's `created` timestamp for ordering or dedupe.

```php
DB::transaction(function () use ($event) {
    $inserted = DB::table('processed_events')->insertOrIgnore(['id' => $event->id, 'created_at' => now()]);
    if ($inserted === 0) return;                          // already handled
    Credits::grant($event->data->object->customer, 100);
});
```

```ts
await prisma.$transaction(async (tx) => {
  try { await tx.processedEvent.create({ data: { id: event.id } }); }   // id is @id / @unique
  catch (e: any) { if (e.code === 'P2002') return; throw e; }
  await grantCredits(tx, event);
});
```

```python
with transaction.atomic():
    _, created = ProcessedEvent.objects.get_or_create(event_id=event["id"])
    if created:
        grant_credits(event["data"]["object"]["customer"], 100)
```

## When it's fine

- The effect is naturally idempotent: setting `status = 'paid'`, or an upsert keyed by the provider's object id. Say so in a comment.
- The handler only enqueues a job keyed by the event id (`jobId: event.id`) and the job dedupes.

## How backslop detects it

A file that verifies a Stripe-style event (`webhooks.constructEvent(`, `Webhook::constructEvent(`, `Webhook.construct_event(`) and has no sign of dedupe anywhere: no `event.id` / `$event->id` / `event["id"]`, `event_id`, `processed_events`, `idempot`, `insertOrIgnore`, `ON CONFLICT`, `firstOrCreate`, `updateOrCreate`, `upsert`, `get_or_create`, `jobId`, `P2002`, `IntegrityError`. It reports medium: a handler whose effect is idempotent by nature is fine, and the scanner can't see that.

## Sources

- Stripe docs, Webhooks best practices ("Handle duplicate events", "Event ordering", automatic retries): https://docs.stripe.com/webhooks
- AWS Builders' Library, "Making retries safe with idempotent APIs": https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/
- Martin Kleppmann, *Designing Data-Intensive Applications*, ch. 11 "Stream Processing" (fault tolerance, idempotence).
