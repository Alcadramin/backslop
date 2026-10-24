# outbound-payment-no-idempotency-key

**A charge, refund, transfer or payout created without a stable idempotency key, or with a fresh key on every attempt.**

Severity: high · Detected by: scanner (static + diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```ts
await stripe.refunds.create({ payment_intent: pi, amount });                         // no key
await stripe.transfers.create(params, { idempotencyKey: crypto.randomUUID() });       // new key per attempt
```

```php
$stripe->refunds->create(['payment_intent' => $order->payment_intent_id]);
```

```python
stripe.Refund.create(payment_intent=pi, amount=amount, api_key=key)
```

The diff version: the agent "cleans up" the options array and the `idempotency_key` / `Idempotency-Key` header goes with it.

## Why it hurts

The same logical operation gets sent twice even with no retry in your code: a user double-clicks, a queue job is redelivered after a worker timeout, a load balancer replays a request. Without a key each one is a new refund or transfer. Stripe stores the first result for a key and returns it for repeats, and it rejects a repeat whose parameters differ. Keys may be pruned once they are at least 24 hours old. AWS says the token must be stored with the mutation and must return an equivalent response on repeat. A key generated inside the call (`randomUUID()`, `Str::uuid()`, `uuid4()`) is new on every attempt, so it protects nothing.

The demo calls the API once, so nothing is duplicated.

## Fix

Derive the key from the business operation, store it with the record, and reuse it on every attempt.

```ts
await stripe.refunds.create(
  { payment_intent: order.paymentIntentId, amount: order.total },
  { idempotencyKey: `order-${order.id}-refund-1` },
);
```

```php
$stripe->refunds->create(
    ['payment_intent' => $order->payment_intent_id],
    ['idempotency_key' => "order-{$order->id}-refund"],
);
```

```python
stripe.Refund.create(payment_intent=pi, amount=amount, api_key=key, idempotency_key=f"refund-{refund.id}")
```

## When it's fine

- The SDK adds its own key for its automatic network retries. That covers only those retries, not a redelivered job or a second click.
- Creating an unconfirmed PaymentIntent, a Customer or a Checkout Session moves no money. A duplicate is clutter, not a double charge. backslop doesn't flag these.
- Test-mode scripts.

## How backslop detects it

Static:
- `stripe.charges|refunds|transfers|payouts.create(` (JS), `->charges|refunds|transfers|payouts->create(` and `\Stripe\Charge::create(`-style calls (PHP), `stripe.Charge|Refund|Transfer|Payout.create(` and `client.refunds.create(` (Python) with no idempotency key in the call.
- `paymentIntents.create` only when it confirms in the same call (`confirm: true`).
- Any of these, plus subscriptions and customers, when the key is generated inline from `randomUUID`, `uuid`, `Str::uuid`, `uniqid`, `uuid4`, `Date.now`, `time()`.

Diff: a removed `idempotencyKey` / `idempotency_key` / `Idempotency-Key` with no key added back within 15 lines while a `create(` / `post(` / `fetch(` call is still within 5 lines.

## Sources

- Stripe API, Idempotent requests: https://docs.stripe.com/api/idempotent_requests
- AWS Builders' Library, "Making retries safe with idempotent APIs": https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/
- Prisma docs, Transactions (idempotent APIs section): https://www.prisma.io/docs/orm/prisma-client/queries/transactions
