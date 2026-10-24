# webhook-heavy-sync

**A webhook handler that does slow work (API calls, emails, PDFs, big DB writes) before it answers.**

Severity: medium · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
if ($event->type === 'checkout.session.completed') {
    $pdf = Pdf::loadView('invoice', $data)->output();
    Http::post($crm, $payload);
    Mail::to($user)->send(new Welcome($pdf));
}
return response('', 200);
```

```ts
const event = stripe.webhooks.constructEvent(body, sig, secret);
await syncToCrm(event);          // seconds
await sendWelcomeEmail(event);
return new Response(null, { status: 200 });
```

## Why it hurts

Stripe says to return a 2xx quickly, before any logic that could time out, and to process events through an asynchronous queue, because a spike of deliveries (month-start renewals) can overwhelm the endpoint. A slow handler times out at the provider, which then retries. Now the endpoint receives duplicates (see [webhook-no-dedupe](webhook-no-dedupe.md)) while it's already overloaded. That's Nygard's Self-Denial and Dogpile shape: the system's own retries pile onto the moment it's weakest.

One test event, one fast mock CRM: the handler answers in milliseconds.

## Fix

Verify the signature, store or enqueue the event, answer 200. Do the work in a job.

```php
ProcessStripeEvent::dispatch($event->id);   // after verifying the signature
return response('', 200);
```

```ts
await queue.add('stripe-event', { id: event.id }, { jobId: event.id });   // jobId also dedupes at enqueue
return new Response(null, { status: 200 });
```

## When it's fine

- The only work is one fast DB write (mark an invoice paid).
- Serverless platforms with background continuation (`waitUntil`) can answer first and finish after. The work still needs to be idempotent.

## How backslop detects it

Review only. Look at each webhook handler: between signature verification and the response, is there any HTTP call, `Mail::` / `->send(`, PDF or image generation, LLM call, or a loop over many rows? If so, move it to a queue.

## Sources

- Stripe docs, Webhooks best practices ("Quickly return a 2xx response", "Handle events asynchronously"): https://docs.stripe.com/webhooks
- Michael Nygard, *Release It!* (2nd ed.), ch. 4 "Stability Antipatterns" (Self-Denial Attacks, Dogpile).
- AWS Builders' Library, "Avoiding insurmountable queue backlogs": https://builder.aws.com/content/3EuRcgkTP1MI0c7zM8W6HL3WIqA/avoiding-insurmountable-queue-backlogs
