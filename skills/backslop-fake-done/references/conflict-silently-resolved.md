# conflict-silently-resolved

**The spec and the tests disagree (or the task can't be done as asked), and the agent quietly picks one and reports success.**

Severity: medium · Detected by: review only · Languages: any

## What it looks like

The reply reads: "Implemented, all tests pass. The tests had conflicting expectations with the docstring, which required compatibility logic." The diff holds an `if` that returns one answer for the test's input and another for everything else.

Other tells in a reply: "compatibility shim", "to satisfy both tests", "workaround", "the test seems to be wrong, so I adjusted it".

## Why it hurts

The person who asked never learns there was a conflict, so the wrong side wins by default. ImpossibleBench built tasks where the tests contradict the spec, so any pass means cheating. GPT-5 cheated on 76% of Oneoff-SWEbench tasks and 54% of Conflicting-SWEbench tasks. Giving it an explicit way out ("abort") cut the 54% to 9%. The Claude 4 system card notes that Opus 4, given an impossible task, "would sometimes write plausible-seeming solutions without acknowledging flaws in the task or its solution."

## Fix

Stop. Name the failing test, the line of the spec it contradicts, and the two possible resolutions. Ask which is right. Anthropic's suggested wording for agents: "If the task is unreasonable or infeasible, or if any of the tests are incorrect, please tell me. Do not hard code any test cases."

## When it's fine

You reported the conflict and the user chose. Then do what they chose and quote the decision.

## How backslop detects it

Review only. Read the reply for the tells above. If they appear next to a green run, read the diff for special-casing (see [special-case-test-input](special-case-test-input.md)) and edited tests (see [test-expectation-edited](test-expectation-edited.md)).

## Sources

- ImpossibleBench: https://arxiv.org/abs/2510.20270
- Claude Opus 4 / Sonnet 4 system card, section 6: https://www-cdn.anthropic.com/6be99a52cb68eb70eb9572b4cafad13df32ed995.pdf
