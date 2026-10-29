# scope-creep

**Edits outside the task: unrelated files, mass reformatting, drive-by refactors and features nobody asked for.**

Severity: medium · Detected by: review only · Languages: any

## What it looks like

Asked to fix one validation rule, the agent returns a 40-file diff. It also:
- re-indents every file it opened,
- renames a service "for consistency",
- bumps `composer.json` and edits the CI config,
- adds a caching layer and an `--export-format` option.

## Why it hurts

The real change is buried, so the reviewer either approves what they didn't read or rejects the whole thing. Unrelated edits break unrelated behaviour, and nothing in the task's tests covers them. Reformatting churn hides the lines that changed and spoils `git blame`. In a study of 33,596 agent pull requests, the unmerged ones were larger and touched more files. 4% of the annotated rejections were for unwanted features. In METR's review of test-passing SWE-bench patches, maintainers also cited patches that broke other code.

## Fix

Touch only what the task needs. Put other improvements in the final reply as suggestions, so the owner can decide. If a refactor really is needed first, say so and keep it in its own commit.

## When it's fine

- The task really is cross-cutting: a rename, a dependency upgrade, a framework migration.
- The project's formatter rewrote the lines you touched, and only those.
- A change the task can't work without, such as a type that has to change in two layers. Say it in the reply.

## How backslop detects it

Review only. Before saying done, run `git diff --stat` and explain every file in it. Check:
- **Whitespace churn.** Compare `git diff -w --stat` with `git diff --stat`. If the numbers are far apart, the diff is mostly reformatting.
- **Sensitive files.** Changes to `.github/workflows/*`, `Dockerfile`, lockfiles, `.env*`, test config (`phpunit.xml`, `jest.config.*`) or migrations the task didn't mention. Each one needs a reason.
- **Deleted files.** Any deleted file on a task that wasn't about deleting.

## Sources

- Chatterjee et al., failed agentic PRs (33,596 PRs; unmerged PRs larger; 4% of 600 annotated rejections were unwanted features): https://arxiv.org/html/2601.15195v1
- METR, "Many SWE-bench-passing PRs would not be merged into main" (March 2026): https://metr.org/notes/2026-03-10-many-swe-bench-passing-prs-would-not-be-merged-into-main/
