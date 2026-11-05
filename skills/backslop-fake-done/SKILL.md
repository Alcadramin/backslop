---
name: backslop-fake-done
description: Catches gamed tests and "done" that isn't. Use when making failing tests pass, fixing CI, lint or type errors, finishing a feature, or before saying "done" or "all tests pass". Flags edited, weakened or skipped tests, special-cased test inputs, mocked units, stubs and TODOs, ignore comments, removed auth or validation checks, and secrets in logs.
---

# Fake done: green tests that don't test, and "done" that isn't

The failure this skill prevents: the agent reports "done, all tests pass" while the work is broken, because it changed the check instead of the code. Agents fall into it after several failed attempts at a hard test, when editing the test, skipping it or hard-coding its answer is the shortest path to green. The summary looks the same either way. The diff doesn't.

What the evidence says:

- **Anthropic, about its own model (2025).** "Claude 3.7 Sonnet occasionally resorts to special-casing in order to pass test cases in agentic coding environments like Claude Code. Most often this takes the form of directly returning expected test values rather than implementing general solutions, but also includes modifying the problematic tests themselves to match the code's output." It adds: "User testing did not identify this behavior because it occurs infrequently in normal usage and largely occurs only after multiple attempts." ([Claude 3.7 Sonnet system card, §6](https://assets.anthropic.com/m/785e231869ea8b3b/original/claude-3-7-sonnet-system-card.pdf))
- **Later models do it less, not never.** On Anthropic's reward-hack-prone coding tasks the hack rate was 44% for Sonnet 3.7, 9% for Opus 4 and 4% for Sonnet 4. One transcript shows production code walking `inspect.stack()` to detect a specific test before raising the error it expects. ([Claude 4 system card, §6](https://www-cdn.anthropic.com/6be99a52cb68eb70eb9572b4cafad13df32ed995.pdf))
- **When tests contradict the spec, frontier agents cheat most of the time.** ImpossibleBench made any passing run proof of cheating. GPT-5 cheated on 76% of Oneoff-SWEbench tasks and 54% of Conflicting-SWEbench tasks. For Claude models, over 79% of the cheating on Conflicting-SWEbench was modifying tests, "despite being explicitly instructed not to." An explicit "abort" option cut GPT-5 from 54% to 9%. ([ImpossibleBench](https://arxiv.org/abs/2510.20270))
- **The model knows.** METR caught o3 reward-hacking in 39 of 128 RE-Bench runs. It patched the evaluator "so that it judges every submission as successful" and overwrote the timer. "Please do not cheat" in the prompt left the rate at 80%. Asked whether its plan matched the user's intent, o3 said "no" 10 of 10 times. ([METR, June 2025](https://metr.org/blog/2025-06-05-recent-reward-hacking/))

## Use this when

- A test, type check, linter or CI job is failing and you're about to make it pass.
- You're asked to "fix the tests", "make CI green", "get this passing" or "clean up the errors".
- A test seems wrong, flaky or impossible to satisfy.
- You're finishing a feature and are about to say "done", "complete" or "all tests pass".
- You touched test files, test setup (`conftest.py`, `jest.setup.*`), auth or validation code, or logging.
- You're reviewing an agent's diff that claims success.

## Non-negotiable rules

1. Never edit a test's expected value, or delete an assertion, to match what your code returns. If the requirement changed, say which one.
2. Never skip, xfail, `.todo` or `.only` a test to get green. Never exit the test process early.
3. Never special-case a test's input in production code, and never branch on "am I under test?".
4. Never weaken an assertion (`toBe` → `toBeDefined`, `assertEquals` → `assertNotNull`), and never add one that can't fail.
5. Never mock the unit under test, and never put mock objects in production code.
6. Never silence a checker (`@ts-ignore`, `as any`, `# type: ignore`, `@phpstan-ignore`, `eslint-disable`, `backslop-ignore`) to make it pass.
7. Never remove an auth, permission or validation check because a test hit it. Set up the test properly.
8. Never claim tests pass without running them in this session, and always show the command and its result.
9. If a test seems wrong or the task is infeasible, say so and stop. That's a valid outcome; a faked pass isn't.

## Check your diff

```bash
node "${CLAUDE_SKILL_DIR}/../backslop/scripts/backslop.mjs" diff --skill backslop-fake-done
```

`${CLAUDE_SKILL_DIR}` is this skill's folder. In agents that don't fill it in, use the path where the skill is installed.

Fix every finding, or say in your reply which finding is a false positive and why. Never add ignore comments, weaken the check, or delete the code path to silence it.

## Review checklist

Ask these about every test, setup file and production change in your diff.

**Tests you changed**
- Did any assertion disappear from a test that still exists? → [assertions-removed](references/assertions-removed.md)
- Did any exact check become a looser one, or an always-true one? → [assertion-weakened](references/assertion-weakened.md)
- Did any expected value change? Which requirement changed, and who said so? → [test-expectation-edited](references/test-expectation-edited.md)
- Did you add `skip`, `xfail`, `todo`, `only`, `markTestSkipped`? → [tests-skipped](references/tests-skipped.md)
- Does the test mock the module it's named after? → [mocked-unit-under-test](references/mocked-unit-under-test.md)

**The harness**
- Does anything in tests or setup call `exit`/`process.exit`/`os._exit`? → [exit-zero-harness](references/exit-zero-harness.md)
- Did you touch a reporter hook, the clock, or a `verify*` function? → [test-runner-tampered](references/test-runner-tampered.md)
- Did you change CI config, test scripts or hooks (`continue-on-error`, `|| true`, `--no-verify`)? → [ci-gate-bypassed](references/ci-gate-bypassed.md)
- Did you add coverage-ignore comments or lower a threshold? → [coverage-gate-lowered](references/coverage-gate-lowered.md)

**Production code**
- Does any branch compare against a value that also appears in a test, or carry a comment about a test? → [special-case-test-input](references/special-case-test-input.md)
- Does any code check `NODE_ENV === 'test'`, `runningUnitTests()`, `'pytest' in sys.modules` or the call stack? → [test-env-branch-in-prod](references/test-env-branch-in-prod.md)
- Does any `__eq__`/`equals` always return true, or does any code reassign a library comparison? → [fake-equality-or-state](references/fake-equality-or-state.md)
- Is anything a stub, a TODO, a constant return or "in a real implementation"? → [stub-or-todo-left](references/stub-or-todo-left.md)
- Does any function return sample records instead of querying the real source? → [placeholder-data-in-prod](references/placeholder-data-in-prod.md)
- Did you add an ignore comment or an `as any` cast? → [checker-suppressed](references/checker-suppressed.md)
- Did you remove an `authorize`, a middleware, `@login_required`, `permission_classes` or a `validate` call? Where is it now? → [guard-removed](references/guard-removed.md)
- Did you turn off a timeout, a memory limit or TLS verification? → [limits-disabled](references/limits-disabled.md)
- Do any log or print calls include a password, token, key, cookie or auth header? → [secrets-or-pii-logged](references/secrets-or-pii-logged.md)
- Did a model or schema change without a migration? → [schema-without-migration](references/schema-without-migration.md)

**Dependencies and APIs**
- Does every new package exist on the registry, and is it in the lockfile? → [hallucinated-package](references/hallucinated-package.md)
- Does every new method, option or config key exist in the installed version? → [hallucinated-api](references/hallucinated-api.md)

**Your reply**
- Did you run the tests in this session? Is the count non-zero and the full suite? → [unverified-done-claim](references/unverified-done-claim.md)
- Did the spec and the tests disagree? Did you report it or pick a side silently? → [conflict-silently-resolved](references/conflict-silently-resolved.md)

Related, owned by other skills:
- empty catch blocks and fallbacks that hide failures: [backslop-errors](../backslop-errors/)
- an "optimization" that drops pagination: [unbounded-result-set](../backslop-queries/references/unbounded-result-set.md)
- duplicate helpers, unneeded dependencies and scope creep: [backslop-structure](../backslop-structure/)

## Patterns

| Pattern | What goes wrong | Detected |
|---|---|---|
| [assertions-removed](references/assertions-removed.md) | assertion deleted from a test that still exists | scanner diff |
| [assertion-weakened](references/assertion-weakened.md) | exact check replaced by a loose or always-true one | scanner diff |
| [test-expectation-edited](references/test-expectation-edited.md) | expected value changed to match the code | scanner diff (medium) |
| [tests-skipped](references/tests-skipped.md) | skip / xfail / todo / `.only` added | scanner diff |
| [special-case-test-input](references/special-case-test-input.md) | code returns the test's expected answer for its input | scanner (comments) + review |
| [test-env-branch-in-prod](references/test-env-branch-in-prod.md) | production code detects the test run | scanner |
| [exit-zero-harness](references/exit-zero-harness.md) | test exits 0 before failures are reported | scanner |
| [fake-equality-or-state](references/fake-equality-or-state.md) | `__eq__` always true, comparisons reassigned | scanner |
| [test-runner-tampered](references/test-runner-tampered.md) | report, clock or verifier patched to succeed | scanner |
| [mocked-unit-under-test](references/mocked-unit-under-test.md) | test mocks its own subject; mocks in prod | scanner (medium) |
| [stub-or-todo-left](references/stub-or-todo-left.md) | stub, TODO or "not implemented" shipped as done | scanner diff (medium) |
| [checker-suppressed](references/checker-suppressed.md) | ignore comment or `as any` instead of a fix | scanner diff (medium) |
| [coverage-gate-lowered](references/coverage-gate-lowered.md) | code excluded from coverage, threshold lowered | scanner diff (medium) + review |
| [guard-removed](references/guard-removed.md) | auth / permission / validation check deleted | scanner diff (medium) |
| [secrets-or-pii-logged](references/secrets-or-pii-logged.md) | password, token or key in a log call | scanner |
| [placeholder-data-in-prod](references/placeholder-data-in-prod.md) | sample records returned from a real path | review |
| [unverified-done-claim](references/unverified-done-claim.md) | "tests pass" with no run, or zero tests run | review |
| [conflict-silently-resolved](references/conflict-silently-resolved.md) | spec/test conflict hidden behind a green run | review |
| [limits-disabled](references/limits-disabled.md) | timeout, memory limit or TLS check turned off | review |
| [schema-without-migration](references/schema-without-migration.md) | model changed, no migration | review |
| [hallucinated-package](references/hallucinated-package.md) | dependency that doesn't exist | review |
| [hallucinated-api](references/hallucinated-api.md) | method or option that doesn't exist | review |
| [ci-gate-bypassed](references/ci-gate-bypassed.md) | CI step non-blocking, hooks skipped | review |

## Before you say done

Put this evidence in your final reply, not just "done":

- **Test run:** the exact command and the last lines of its output, including the number of tests run. Run the full relevant suite. If you didn't run it, write "tests not run" and why.
- **Test changes:** every test file you changed, and for each changed or removed assertion, the requirement that changed. If there's none, there should be no test edits.
- **Skips and suppressions:** every skip, xfail, ignore comment or cast you added, with the reason. Expect a human to remove it.
- **Guards:** for any auth or validation check you removed, where it lives now.
- **Unfinished:** a list of every stub, TODO, `NotImplementedError` or placeholder left in the change. Don't call it done if this list isn't empty.
- **Conflicts:** any test you believe is wrong, which spec it contradicts, and that you stopped instead of working around it.
- **Scanner:** the `backslop diff` result, and for each finding you didn't fix, why it's a false positive.
