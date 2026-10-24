# floating-promise-or-task

**Async work started and then dropped: not awaited, not kept, errors never seen.**

Severity: medium · Detected by: scanner (static Python + diff) · Languages: TypeScript/JavaScript, Python

## What it looks like

```ts
app.post('/signup', async (req, res) => {
  const u = await createUser(req.body);
  sendWelcomeEmail(u);            // was `await sendWelcomeEmail(u)`; now nobody waits or catches
  res.json(u);
});
```

```python
async def signup(request):
    user = await create_user(request)
    asyncio.create_task(send_welcome_email(user))   # reference dropped
    return JSONResponse({"id": user.id})
```

Agents remove the `await` to make an endpoint "faster".

## Why it hurts

The work is now invisible to the request. If it rejects, the error becomes an unhandled rejection, which recent Node versions treat as fatal by default. On serverless the instance can be frozen as soon as the response is sent, so the work stops mid-flight. Nothing bounds how many pile up under load. In Python the event loop keeps only a weak reference to tasks, and the asyncio docs say to save a reference to the result of `create_task`, because a task that isn't referenced may be garbage-collected at any time, even before it's done. Its exception only shows up as "Task exception was never retrieved". In Python, calling a coroutine function without `await` doesn't run it at all.

The test awaits the response, the email mock resolves instantly, and everything looks done.

## Fix

Await it, or move it to a real queue. If losing the work is truly acceptable, keep a reference and handle the error.

```ts
await queue.add('welcome-email', { userId: u.id });    // durable
// or, when dropping it is acceptable:
void sendWelcomeEmail(u).catch((e) => log.error({ e }, 'welcome email failed'));
```

```python
background = set()
t = asyncio.create_task(send_welcome_email(user))
background.add(t)
t.add_done_callback(background.discard)
# or: async with asyncio.TaskGroup() as tg: tg.create_task(...) when the request should wait
```

## When it's fine

- Intentional fire-and-forget with an explicit `void p.catch(log)` and work you can afford to lose.
- Event emitters and callbacks that aren't promises.
- `tg.create_task(...)` inside a `TaskGroup`, which keeps the reference.

## How backslop detects it

- Python, static: `asyncio.create_task(` / `asyncio.ensure_future(` / `loop.create_task(` as a statement of its own, with the result not assigned, returned, or put in a list or call.
- JS/TS and Python, diff: a removed line `await foo(...)` and, within 2 lines, an added line that is exactly `foo(...)` with no `await`, `return`, assignment, `void` or `.catch`.

Without type information backslop can't tell which calls return promises, so new floating promises written from scratch are left to typescript-eslint's `no-floating-promises`, which does this properly with types.

## Sources

- Python docs, Coroutines and Tasks (`create_task` reference note, `TaskGroup`): https://docs.python.org/3/library/asyncio-task.html
- Stripe docs, Webhooks ("Handle events asynchronously", moving work to a queue): https://docs.stripe.com/webhooks
- AWS Builders' Library, "Avoiding insurmountable queue backlogs": https://builder.aws.com/content/3EuRcgkTP1MI0c7zM8W6HL3WIqA/avoiding-insurmountable-queue-backlogs
- Node's unhandled-rejection default (`throw` since Node 15) is from the Node 15 release notes and was not re-checked for this page.
