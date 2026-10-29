---
name: backslop-structure
description: Catches accidental complexity agents add to backend code. Flags single-implementation interfaces, pass-through layers, unused options, copied or v2 helpers, flag params, narrating comments, JSON round-trips, micro-dependencies. Use when adding classes, interfaces, wrappers, helpers, dependencies or config, or when asked to refactor, simplify, clean up, "make it extensible" or DRY code.
---

# backslop-structure: the smallest structure that does the job

Agents add structure because structure looks like diligence: an interface "for flexibility", a service that forwards to the repository, an `$options` array nobody passes, a `processOrderV2()` next to the original, a package for one line. Each piece passes the tests and costs every later reader. The opposite mistake is just as real. Told to "keep it DRY", agents merge code that only looks alike into a helper with flags. This skill covers both.

## Use this when

- You are adding a class, interface, abstract base, factory, wrapper, "manager", "service" or "helper".
- You are adding a parameter, option, config key, flag or extension point.
- You are writing a utility function (`format*`, `slugify`, `retry`, `chunk`, `get`). It probably exists already.
- You are adding a dependency to `package.json`, `composer.json`, `requirements.txt` or `pyproject.toml`.
- You were asked to **refactor, simplify, clean up, remove duplication, make it reusable or make it extensible**. Agents most often add layers or force a merge here.
- You were asked to change a function and are tempted to write a new one next to it.

## Non-negotiable rules

1. No interface, abstract base or factory until a second implementation or a test fake exists.
2. No class whose methods only forward to one collaborator. Use the collaborator.
3. No parameter, option, config key or `match` arm that no caller in this change uses.
4. Search the repo, the framework and the stdlib before writing a helper. Reuse what is there.
5. Never leave the old version next to a new one (`fooV2`, `fooNew`, `fooOptimized`). Change it in place, or move the callers and delete the old one.
6. Don't merge code that only looks alike. If merging needs a flag or a type switch, keep the duplication.
7. No new dependency for something the language or an installed package does in a few lines. Justify every new dependency in your reply.
8. Comments say why, not what. Never narrate the edit ("Added X to fix Y", "as requested").
9. Stay in scope. Don't reformat, rename or "improve" code the task didn't need.

## Check your diff

```bash
node "${CLAUDE_SKILL_DIR}/../backslop/scripts/backslop.mjs" diff --skill backslop-structure
```

`${CLAUDE_SKILL_DIR}` is this skill's folder. In agents that don't fill it in, use the path where the skill is installed.

Fix every finding, or say in your reply which finding is a false positive and why. Never add ignore comments, weaken the check, or delete the code path to silence it.

## Review checklist

Ask these about each piece of code you wrote or changed.

**New types and layers**
- Does this interface or abstract class have a second implementation or a test fake today? If not, delete it. ([single-implementation-abstraction](references/single-implementation-abstraction.md))
- Does each method of this class do something beyond calling the same method on one field: translate, validate, retry, cache, authorize? If not, remove the layer. ([pass-through-wrapper](references/pass-through-wrapper.md))
- Is this class already over 500 lines, 20 public methods or 8 dependencies? Extract instead of adding a method. Is the new `extends` making a project chain three deep? Delegate instead. ([deep-inheritance-or-god-class](references/deep-inheritance-or-god-class.md))

**Parameters, options, config**
- For every parameter with a default, every `$options`/`**kwargs` key, every `match` arm and every new config key: which caller uses it? ([speculative-generality](references/speculative-generality.md))
- Did I add a boolean to an existing function with an `if` on it? Write a named second function instead. ([boolean-flag-param](references/boolean-flag-param.md))
- Is this shared helper growing a branch per caller, so that no caller uses all of it? Inline it into the callers and re-extract only the shared part. ([wrong-abstraction](references/wrong-abstraction.md))
- Six or more parameters, or the same three passed together everywhere? Introduce an object. ([long-parameter-list](references/long-parameter-list.md))

**Reuse versus duplication**
- Did I search for an existing helper (repo, framework, installed packages) before writing this one? ([duplicate-helper](references/duplicate-helper.md))
- Is there a built-in for this loop or helper: `in_array`, `str_contains`, `Arr::get`, `.some`, `structuredClone`, `any()`, `Counter`? ([reimplemented-stdlib](references/reimplemented-stdlib.md))
- If two blocks look the same, do they change for the same reason? If not, leave both. Duplication is cheaper than the wrong abstraction. ([wrong-abstraction](references/wrong-abstraction.md))

**Leftovers**
- Is there an old version, an unused import, a parameter kept "for compatibility", a private method nobody calls, or commented-out code? Delete it. ([dead-code](references/dead-code.md))
- Does a function I touched now mix input parsing, queries, business rules, formatting and side effects? Split by phase. ([long-function-mixed-concerns](references/long-function-mixed-concerns.md))
- Does a comment repeat the next line or describe my edit? Delete it or replace it with the why. ([narrating-comments](references/narrating-comments.md))
- Am I converting a value to JSON and back, or array to object and back, just to change its form or copy it? ([needless-type-roundtrip](references/needless-type-roundtrip.md))

**Dependencies and scope**
- For each added manifest line: what does it do that the language or an installed package can't do in a few lines? Does the package name really exist? ([new-dependency-for-trivial](references/new-dependency-for-trivial.md))
- Does every file in `git diff --stat` belong to the task? Is any of it whitespace churn or a drive-by refactor? ([scope-creep](references/scope-creep.md))

## Patterns

| id | what goes wrong | detected |
|---|---|---|
| [single-implementation-abstraction](references/single-implementation-abstraction.md) | interface or factory with one concrete type | scanner (same file) + review |
| [pass-through-wrapper](references/pass-through-wrapper.md) | class that only forwards calls (Middle Man) | scanner |
| [speculative-generality](references/speculative-generality.md) | options, hooks and config nobody uses | review |
| [reimplemented-stdlib](references/reimplemented-stdlib.md) | hand-written built-ins | review |
| [duplicate-helper](references/duplicate-helper.md) | second copy of an existing helper | scanner (same file) + review |
| [dead-code](references/dead-code.md) | v2 next to v1, unused code | scanner diff + review |
| [long-function-mixed-concerns](references/long-function-mixed-concerns.md) | one function doing every phase | review |
| [boolean-flag-param](references/boolean-flag-param.md) | flag bolted onto an existing function | scanner diff + review |
| [long-parameter-list](references/long-parameter-list.md) | 6+ params, data clumps | review |
| [narrating-comments](references/narrating-comments.md) | comments that repeat code or narrate the edit | scanner |
| [needless-type-roundtrip](references/needless-type-roundtrip.md) | JSON encode/decode to convert or clone | scanner |
| [wrong-abstraction](references/wrong-abstraction.md) | shared helper grown a branch per caller | review |
| [deep-inheritance-or-god-class](references/deep-inheritance-or-god-class.md) | deep chains, classes that do everything | review |
| [new-dependency-for-trivial](references/new-dependency-for-trivial.md) | package for a one-liner | scanner (imports) + review |
| [scope-creep](references/scope-creep.md) | edits outside the task | review |

## Before you say done

State in your reply:
- **Each new type or layer** (class, interface, wrapper, factory): what it hides or translates, and its second implementation if it is an interface.
- **Each new parameter, option or config key**: the caller in this change that uses it.
- **Each new helper**: what you searched for (`grep` pattern or path) and why the existing ones didn't fit.
- **Each duplication you kept on purpose**: why the copies will change for different reasons.
- **Each new dependency**: what it does that the stdlib or an installed package can't, and that you confirmed the name on the registry.
- **Files touched**: every file in `git diff --stat` and why it is part of the task.
- **backslop**: "0 findings", or each finding and why it is a false positive.
