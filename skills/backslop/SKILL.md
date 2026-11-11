---
name: backslop
description: Checks backend code an AI agent wrote or changed before it is called done. Runs the backslop scanner on the diff, routes to the right area skill (queries, connections, resilience, loops, structure, errors, fake-done), and requires an evidence-based done report. Use before finishing any backend task, when reviewing an agent's diff or PR, or when asked to optimize, refactor, speed up or fix backend code.
---

# backslop: no thumbs-up until the backend work holds up

Agents report "done, tests pass" on work that falls over in production. They remove a `LIMIT` to "optimize", wrap a failing call in `try/catch` that returns `[]`, write a loop that is O(n²) on real data, or edit the test until it agrees. Small test data hides all of it. This skill is the check you run before you say done.

## Use this when

- You are about to tell the user a backend task is finished.
- You were asked to **optimize, speed up, simplify, refactor or clean up** code that touches a database, an external service, or a loop over data. These requests are where agents most often trade correctness for an easy win.
- You were asked to **make failing tests pass** or fix a flaky test.
- You are reviewing a diff or PR that an agent wrote.

## Procedure

1. **See what changed.**
   ```bash
   git status --short && git diff --stat
   ```
2. **Run the scanner on the diff.** It judges only what changed, not old code.
   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/backslop.mjs" diff
   ```
   `${CLAUDE_SKILL_DIR}` is this skill's folder. In agents that don't fill it in, use the path where the skill is installed.
   Use `--base main` to check a whole branch, or `--json` for structured output.
3. **Open the area skill for each part of the change.** The scanner only catches what a regex can see. The area skills hold the checklists for the rest.

   | The diff touches | Read |
   |---|---|
   | SQL, ORM calls, pagination, migrations, indexes | `backslop-queries` |
   | DB/HTTP clients, pools, transactions, locks, jobs dispatched from transactions | `backslop-connections` |
   | HTTP calls, retries, webhooks, queues, streams, caches, `Promise.all`, sync I/O in handlers | `backslop-resilience` |
   | loops, `array_*` / `.map/.filter` chains, lookups, sorting, dedupe | `backslop-loops` |
   | new classes, interfaces, wrappers, helpers, dependencies, config options | `backslop-structure` |
   | `try/catch`, `except`, fallbacks, default values on failure, `@` suppression | `backslop-errors` |
   | tests, CI config, type or lint suppressions, TODOs, stubs, guards, auth checks | `backslop-fake-done` |

4. **Fix every finding**, then run the scanner again. If a finding is a false positive, leave the code alone and say in your reply which finding it is and why it is safe. Never add an ignore comment, weaken a test, loosen a check or delete a code path to make a finding go away. That is the exact behavior this tool exists to catch.
5. **Run the real checks**: the project's tests, linters and type checker. Use the commands the project actually uses, and read their output.
6. **Write the done report** (below).

## When asked to optimize

- Measure or reason about the real cost first: query count, rows read, allocations, round trips. Say which one you are improving.
- Keep every bound, guard and transaction. Fewer queries that load the whole table is a regression.
- Prefer pushing work to the database (filter, sort, count, aggregate in SQL) and batching (eager loading, `whereIn`, bulk writes).
- If you did not measure, say "not measured". Never invent a speedup.

## Done report

End a backend task with this, filled in truthfully:

```
Changed: <files and what each change does, one line each>
Verified: <exact commands you ran in this session and their result, e.g. "php artisan test: 142 passed">
backslop: <"0 findings", or each remaining finding and why it is safe>
Not verified: <what you could not check: production data volume, a service you could not reach, an untested path>
```

If you did not run something, it goes under "Not verified", not "Verified". A run you remember from earlier, or one you expect would pass, doesn't count.

## Limits

The scanner works on regexes and scope tracking. It doesn't parse a full AST and doesn't know your schema or data volume. It's tuned for few false positives, so it misses things. The checklists in the area skills cover what it can't see.
