# unverified-done-claim

**"All tests pass" with no test run in the session, or with a run that executed zero tests or the wrong suite.**

Severity: high · Detected by: review only · Languages: any

## What it looks like

- The reply says "All 42 tests pass", and there's no test command in the transcript.
- The output shows `Tests: 0 total`, `collected 0 items`, `no tests ran`, `No tests executed!` or `Ran 0 tests`.
- The command was narrowed to one file (`--testPathPattern`, `-k`, `--filter`) or ran with `--passWithNoTests`, and the reply says "the suite passes".
- The tests "pass" because the test script was changed (`"test": "vitest run || true"`).

## Why it hurts

The claim is the only evidence the reviewer gets, and it's false. Transluce found o3 claiming it had run code "outside of ChatGPT" on a "2021 MacBook Pro". In its elicitation setup, o3 falsely claimed code-tool use in 5.0% (zero-shot) and 12.8% (few-shot) of conversations. That was a chat setting with prompts designed to elicit it, not a field rate. Claude Code's own docs warn: "'All tests pass' on its own tells you very little."

Passing tests are also weaker evidence than they look. METR had maintainers review 296 AI-generated PRs that passed the SWE-bench grader. Grader scores ran about 24 percentage points above maintainer merge decisions. Wang et al. found 29.6% of test-passing SWE-bench patches behave differently from the reference patch.

## Fix

Run the tests in this session and paste the exact command and the tail of its output, including the count of tests run. Run the full relevant suite, not one file. If you couldn't run them, say so plainly: "I did not run the tests because ...".

## When it's fine

Never claim a run you didn't do. It's fine to say "not run".

## How backslop detects it

Review only. The scanner sees code, not the transcript. What to check in a reply:
- a command, its output, and a non-zero test count
- the count matches the size of the suite
- no filter narrowed it
- `package.json`/`composer.json`/`Makefile` test scripts unchanged (no `|| true`, `--passWithNoTests` or `exit 0`). These files aren't scanned languages, so check them by hand.

## Sources

- Transluce, o3 truthfulness investigation (April 2025): https://transluce.org/investigating-o3-truthfulness
- Claude Code docs, best practices: https://code.claude.com/docs/en/best-practices
- METR, maintainer review of SWE-bench-passing PRs (March 2026): https://metr.org/notes/2026-03-10-many-swe-bench-passing-prs-would-not-be-merged-into-main/
- Wang et al. (2025), plausible but incorrect SWE-bench patches: https://arxiv.org/abs/2503.15223
