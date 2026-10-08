---
name: backslop-errors
description: Catches error handling that hides failure so work looks done - empty catch, catch that returns [] or null, log-and-continue, @ suppression, return in finally, lost error cause, unchecked return codes. Use when writing or reviewing try/catch, except, fallbacks or retries, or when asked to fix a crash, make tests pass, or "handle errors".
---

# Error handling: failures stay visible

When code it can't fix keeps throwing, an agent's easiest move is a try/catch that returns `[]`, `null` or `true`. The demo never fails again, the tests go green, and the agent reports success. It's a thumbs-up on code that is still broken. The failure now surfaces later, in another place, as wrong data and with no stack trace. This skill keeps errors loud: crash early, catch only what you can handle, and never let a failure look like a normal result.

Two ideas to hold at once:
- **Dead programs tell no lies** (Hunt & Thomas, *The Pragmatic Programmer*, Topic 24). A program that stops at the first impossible state does far less damage than one that carries on with bad data.
- **Define errors out of existence** (Ousterhout, *A Philosophy of Software Design*, ch. 10). Sometimes the right design is one where the case isn't an error at all: deleting a missing key is a no-op, and an empty search is an empty list. That is a decision about what an operation *means*, made in the API and written down. Wrapping a database call in `catch { return []; }` changes nothing about what the call means. It just hides the outage. Ousterhout warns against taking the idea too far.

## Use this when

- You are about to write `try`/`catch`/`except`, a `.catch(...)`, a fallback value, or a retry.
- A test or demo fails with an exception and you are "fixing" it. Fix the cause. Don't catch it.
- You are asked to "add error handling", "make it robust", "stop it crashing" or "handle edge cases".
- You are asked to simplify or refactor code that has a `throw`/`raise` in a catch. Keep the throw.
- You call something that reports failure through its return value (`curl_exec`, `move_uploaded_file`, `subprocess.run`, `json_decode`).
- You add a null check or default value "just in case".

## Non-negotiable rules

1. Never add a try/catch to make a failing test, build or demo pass. Find out why it throws.
2. Never return `[]`, `{}`, `0`, `''` or `true` from a catch. A failure must not look like a normal result.
3. Never remove a `throw`/`raise` from a catch, or replace it with a log line or a return value, unless the user asked for that behavior change.
4. Catch the narrowest type you can actually handle. Let everything else reach the top-level handler.
5. If you log and continue, the code after the catch must not report success (`return true`, `{ ok: true }`, `markPaid()`).
6. When you wrap an error, pass the original as the cause (`new X($msg, 0, $e)`, `{ cause: err }`, `raise X from e`).
7. No `return`/`throw`/`break`/`continue` inside `finally`.
8. No PHP `@`. Check the result instead.
9. Every deliberately ignored error gets a narrow type and a one-line comment saying why ignoring it is correct.

## Check your diff

```bash
node "${CLAUDE_SKILL_DIR}/../backslop/scripts/backslop.mjs" diff --skill backslop-errors
```

`${CLAUDE_SKILL_DIR}` is this skill's folder. In agents that don't fill it in, use the path where the skill is installed.

Fix every finding, or say in your reply which finding is a false positive and why. Never add ignore comments, weaken the check, or delete the code path to silence it.

## Review checklist

For each catch, except or `.catch` you wrote or changed:
- Does it do anything? An empty or comment-only body around real work hides the failure. → [empty-catch](references/empty-catch.md)
- Does it return something a caller would read as success or "no data"? → [fallback-that-lies](references/fallback-that-lies.md)
- Does it only log, and then the function returns success or the next step runs? → [catch-log-continue](references/catch-log-continue.md)
- Does it only rethrow the same error? Delete the try. → [catch-rethrow-same](references/catch-rethrow-same.md)
- Is the caught type wider than what you can handle (`\Throwable`, `Exception`, bare `except:`)? → [broad-catch](references/broad-catch.md)
- If it throws a new error, is the original attached as the cause? → [lost-error-cause](references/lost-error-cause.md)
- Is it inside `DB::transaction`, `$transaction` or `atomic()`? Swallowing there commits partial work. → [swallowed-exception-in-transaction](../backslop-connections/references/swallowed-exception-in-transaction.md)

For control flow and return values:
- Is there any jump in a `finally` block? → [finally-overrides-exception](references/finally-overrides-exception.md)
- Is any `@` silencing a PHP warning? → [error-suppression-operator](references/error-suppression-operator.md)
- Does a call report failure through its return value, and is that value checked? → [ignored-failure-return](references/ignored-failure-return.md)

For defensive code:
- Does a null check or `??` guard a value whose type already forbids null, and does it silently return? → [redundant-null-checks](references/redundant-null-checks.md)
- Is the same validation now in more than one layer, and do the copies agree? → [validation-everywhere](references/validation-everywhere.md)

## Patterns

| Pattern | What goes wrong | Detected |
|---|---|---|
| [empty-catch](references/empty-catch.md) | the error is thrown away and the code carries on | scanner + scanner diff |
| [fallback-that-lies](references/fallback-that-lies.md) | an outage returns `[]`/`0`/`true` and looks like real data | scanner + scanner diff |
| [catch-log-continue](references/catch-log-continue.md) | logged, then reported as success | scanner + scanner diff |
| [catch-rethrow-same](references/catch-rethrow-same.md) | a try/catch that does nothing | scanner |
| [lost-error-cause](references/lost-error-cause.md) | a wrapped error drops the original | scanner |
| [error-suppression-operator](references/error-suppression-operator.md) | PHP `@` hides why a call failed | scanner |
| [finally-overrides-exception](references/finally-overrides-exception.md) | a jump in `finally` discards the exception | scanner |
| [broad-catch](references/broad-catch.md) | catch-all also catches the bugs | scanner (bare `except:`) + review |
| [ignored-failure-return](references/ignored-failure-return.md) | `false`/exit code ignored | scanner (short list) + review |
| [redundant-null-checks](references/redundant-null-checks.md) | impossible-case checks that silently return | scanner (PHP params) + review |
| [validation-everywhere](references/validation-everywhere.md) | the same check in every layer, drifting apart | review |

## Before you say done

State in your reply, for each try/catch you added or changed:
- what it catches (the exact type) and why that type can be handled here;
- what the caller sees when it fails: the exception, an error status or a failure result. It must never be `[]`, `0` or `true`;
- for every `throw`/`raise` you removed: why, and what now reports the failure.

If you fixed a failing test or a crash, say what the root cause was. "Wrapped it in try/catch" is not a root cause. Paste the backslop output, or say that it reported no findings.
