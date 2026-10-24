# event-loop-blocking

**A synchronous file, process or crypto call (Node), or a blocking call inside `async def` (Python), on the request path.**

Severity: high · Detected by: scanner (static) · Languages: TypeScript/JavaScript, Python

## What it looks like

```ts
app.get('/invoice/:id', (req, res) => {
  const tpl = fs.readFileSync('./templates/invoice.html', 'utf8');
  res.send(render(tpl, req.params.id));
});
app.post('/login', async (req, res) => {
  const hash = crypto.pbkdf2Sync(req.body.password, salt, 600_000, 64, 'sha512');
});
```

```python
async def quote(request):
    r = requests.get(f"{API}/quote", timeout=5)    # blocks the loop
    time.sleep(1)                                   # blocks every other task for 1 s
```

## Why it hurts

Node runs your JavaScript on one thread. While a sync call runs, every other request on that process waits. The Node guide treats this as both a throughput problem and a denial-of-service vector, and names the APIs to avoid on a server: `crypto.pbkdf2Sync`, `crypto.randomFillSync`, `zlib.*Sync`, all sync `fs`, and `child_process.*Sync`. A 600,000-iteration PBKDF2 hash blocks the process for its whole duration, once per login. The same applies to asyncio: the Python docs say a CPU-bound or blocking call of one second delays every task by one second, and `requests.get` or `time.sleep` inside `async def` freezes the loop.

With one test request at a time nobody else is waiting, so the latency is invisible.

## Fix

```ts
const tpl = fs.readFileSync('./templates/invoice.html', 'utf8');   // module top level: once at startup
const pbkdf2 = promisify(crypto.pbkdf2);
app.post('/login', async (req, res) => {
  const hash = await pbkdf2(req.body.password, salt, 600_000, 64, 'sha512');
});
// large JSON or CPU work: stream-parse, or move it to a worker_thread
```

```python
async def quote(request):
    async with httpx.AsyncClient(timeout=5) as c:
        r = await c.get(f"{API}/quote")
    await asyncio.sleep(1)
    out = await asyncio.get_running_loop().run_in_executor(None, cpu_heavy, data)
```

## When it's fine

- Startup code at module top level, CLI scripts, build tooling, config loading, tests.
- `existsSync` and other tiny syscalls on a cold path. backslop doesn't flag `existsSync`.
- Blocking calls in a plain `def` (not `async def`) in Python. Those don't run on the event loop unless an `async def` calls them directly; check that one doesn't.

## How backslop detects it

- Node: a `*Sync(` call from fs, child_process, crypto (`pbkdf2Sync`, `scryptSync`, `randomFillSync`, `generateKeyPairSync`) or zlib, inside a function that is a request handler: its parameters are `(req, res)` / `(request, reply)`, it's passed to `app.get/post/...(` or `router.x(`, it's a tRPC `.query(` / `.mutation(`, an exported `GET`/`POST`/`loader`/`action`, a NestJS `@Get()` method, or it's any function in a route file (`pages/api/`, `app/**/api/`, `route.ts`, `routes/`, `controllers/`, `handlers/`). Top-level calls, scripts, config files, tests and frontend paths are skipped.
- Python: `requests.get/post/...(`, `time.sleep(`, `urllib.request.urlopen(`, `psycopg2.connect(` whose innermost function is `async def`. A sync helper defined inside the `async def` (run through an executor) isn't flagged.

## Sources

- Node.js, "Don't Block the Event Loop (or the Worker Pool)": https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop
- Node.js fs docs ("The synchronous APIs block the Node.js event loop"): https://nodejs.org/api/fs.html
- Python docs, "Developing with asyncio", Running Blocking Code: https://docs.python.org/3/library/asyncio-dev.html
- Michael Nygard, *Release It!* (2nd ed.), ch. 4 "Stability Antipatterns" (Blocked Threads).
