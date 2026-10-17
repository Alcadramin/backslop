---
name: backslop-connections
description: Use when writing or changing code that opens DB/Redis/HTTP clients, uses connection pools, transactions, row locks, queues or retries, or when asked to fix a timeout, deadlock, "too many connections" or a race. Catches network calls and dispatches inside transactions, swallowed errors that commit half a change, leaked or per-request connections, and removed locks or transactions.
---

# Connections and transactions: keep every write atomic, every lock short, every connection returned

This skill prevents the bugs that only appear under concurrency: lost updates, half-committed changes, jobs that run before their data exists, and pools that empty out. Agents fall into them because a single test request never competes with another one. A mock HTTP call answers in a millisecond, and a pool of one idle connection hides every leak. The demo passes, the change gets reported as done, and production breaks on the first busy day.

## Use this when

- You add or change a `DB::transaction`, `$transaction`, `.transaction(`, `transaction.atomic()`, `BEGIN`/`COMMIT`, or code that runs inside one.
- You add HTTP, email, payment, LLM or queue calls near database writes.
- You create a database, Redis or HTTP client, or configure a pool (`max`, `pool_size`, timeouts).
- You read a row, change it in code and write it back (stock, balance, quota, seats, counters).
- You're asked to **fix a timeout, deadlock, lock wait, "too many connections" or pool exhaustion**. The tempting fixes are removing the transaction, the lock or the timeout, or raising the pool size, and each one trades a visible error for silent data damage.
- You're asked to **simplify or optimize** a query that has `lockForUpdate()` / `select_for_update()` / `FOR UPDATE`, or a service method wrapped in a transaction.
- You're asked to **make a failing step not crash** inside a transaction.

## Non-negotiable rules

1. Never remove a transaction, a row lock or a database timeout to make an error go away. Find out why it fired.
2. No network call (HTTP, mail, payment, LLM) inside a transaction. Do it after commit, or write an outbox row.
3. Jobs and messages dispatched from a transaction run after commit: `->afterCommit()`, `on_commit`, or an outbox.
4. Never catch a database error inside a transaction body without rethrowing. Catch outside, or use a savepoint.
5. Writes that must succeed together go in one transaction.
6. Read-modify-write on shared rows needs an atomic update, a row lock in the same transaction, or a version check.
7. One client or pool per process, created at startup. Never one per request or per loop iteration.
8. Every checked-out connection is released in `finally` (or `with` / `using`). Never send `BEGIN` through `pool.query()`.
9. Higher isolation levels and multi-row locks come with a retry for 40001/40P01 and a consistent lock order.

## Check your diff

```bash
node "${CLAUDE_SKILL_DIR}/../backslop/scripts/backslop.mjs" diff --skill backslop-connections
```

`${CLAUDE_SKILL_DIR}` is this skill's folder. In agents that don't fill it in, use the path where the skill is installed.

Fix every finding, or say in your reply which finding is a false positive and why. Never add ignore comments, weaken the check, or delete the code path to silence it.

## Review checklist

**Inside each transaction body**
- Does anything leave the process: HTTP, mail, payment, LLM, SDK calls? → [network-call-in-transaction](references/network-call-in-transaction.md)
- Is a job, event or message dispatched, and does it run only after commit? → [dispatch-before-commit](references/dispatch-before-commit.md)
- Is there a `try/catch` around a write that doesn't rethrow? → [swallowed-exception-in-transaction](references/swallowed-exception-in-transaction.md)
- Does a helper called here open or commit its own "transaction"? → [nested-transaction-assumption](references/nested-transaction-assumption.md)
- How many rows can it touch, and how long are locks held? → [oversized-transaction](references/oversized-transaction.md)
- Is the isolation level raised, or are several rows locked? Is there a retry and a lock order? → [unhandled-deadlock-serialization](references/unhandled-deadlock-serialization.md)

**Around each group of writes**
- Must these writes succeed together? Are they in one transaction? → [missing-transaction-multi-write](references/missing-transaction-multi-write.md)
- Is a value read, changed in code, and written back? What stops two requests doing it at once? → [lost-update-read-modify-write](references/lost-update-read-modify-write.md) (query-shape side: [read-modify-write](../backslop-queries/references/read-modify-write.md))
- Is uniqueness checked in code before an insert? Is there a unique index behind it? → [check-then-insert-race](references/check-then-insert-race.md)

**Clients and pools**
- Where is each DB/Redis client created: module level, or per request or loop? → [db-client-per-request](references/db-client-per-request.md)
- Is an HTTP client or session reused across calls? → [http-client-per-call](references/http-client-per-call.md)
- Is every `connect()` / `getconn()` released on every path? → [connection-not-released](references/connection-not-released.md)
- Are `BEGIN`/`COMMIT` sent on one checked-out client, not the pool? → [transaction-on-pool-query](references/transaction-on-pool-query.md)
- Is a connection held across slow non-DB work? → [connection-held-during-slow-work](references/connection-held-during-slow-work.md)
- Is the pool size small, and is replicas × max under `max_connections`? → [pool-oversized](references/pool-oversized.md)
- Does serverless code go through a pooler? → [serverless-without-pooler](references/serverless-without-pooler.md)
- Does anything rely on session state (`SET`, advisory locks, `LISTEN`, persistent PDO) through a pooler? → [session-state-through-pooler](references/session-state-through-pooler.md)
- Are statement, lock and pool-acquire timeouts set somewhere? → [no-db-timeouts](references/no-db-timeouts.md)

## Patterns

| Pattern | What goes wrong | Detected |
|---|---|---|
| [network-call-in-transaction](references/network-call-in-transaction.md) | Locks and a connection held during a remote call. The side effect can't roll back | scanner + diff |
| [dispatch-before-commit](references/dispatch-before-commit.md) | A worker runs before the commit, or after a rollback | scanner + diff |
| [swallowed-exception-in-transaction](references/swallowed-exception-in-transaction.md) | A caught DB error commits half a change, or breaks every later query | scanner + diff |
| [transaction-on-pool-query](references/transaction-on-pool-query.md) | `BEGIN` on one connection, the writes on others | scanner |
| [db-client-per-request](references/db-client-per-request.md) | A pool per request exhausts `max_connections` | scanner |
| [connection-not-released](references/connection-not-released.md) | Each error leaks a connection until the pool is empty | scanner + diff |
| [lost-update-read-modify-write](references/lost-update-read-modify-write.md) | Removed lock: concurrent writers overwrite each other | scanner diff |
| [missing-transaction-multi-write](references/missing-transaction-multi-write.md) | Removed transaction: a failure leaves half the writes | scanner diff |
| [pool-oversized](references/pool-oversized.md) | A pool above 50 per process: slower, and replicas multiply it | scanner |
| [unhandled-deadlock-serialization](references/unhandled-deadlock-serialization.md) | Serializable with no retry: users get 500s | scanner |
| [no-db-timeouts](references/no-db-timeouts.md) | A removed timeout lets a runaway query hold locks forever | scanner diff |
| [check-then-insert-race](references/check-then-insert-race.md) | Two requests pass the check, two rows get inserted | review |
| [nested-transaction-assumption](references/nested-transaction-assumption.md) | An inner "commit" commits nothing, or ends the outer one | review |
| [oversized-transaction](references/oversized-transaction.md) | Minutes of locks, replication lag, vacuum blocked | review |
| [http-client-per-call](references/http-client-per-call.md) | No keep-alive: a new TLS handshake per call, port exhaustion | review |
| [serverless-without-pooler](references/serverless-without-pooler.md) | Each instance holds its own pool, and a spike exhausts the database | review |
| [connection-held-during-slow-work](references/connection-held-during-slow-work.md) | The pool caps throughput while connections sit idle | review |
| [session-state-through-pooler](references/session-state-through-pooler.md) | `SET` or advisory locks land on another client's session | review |

## Before you say done

State in your reply:
- For each transaction you touched: what it covers, and confirmation that it makes no network calls and dispatches only after commit.
- For each read-modify-write on shared data: whether it's atomic, locked or version-checked, and which.
- For each new client or pool: where it's created and its size.
- If you changed a timeout, lock, transaction or pool size: the root cause you found, and why the change doesn't hide it.
- The output of the diff check above, with every finding fixed or explained.
