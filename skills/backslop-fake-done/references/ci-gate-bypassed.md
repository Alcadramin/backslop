# ci-gate-bypassed

**A CI step or git hook was disabled, made non-blocking, or skipped, so a failing check no longer stops the merge.**

Severity: high · Detected by: review only · Languages: CI config, package scripts, shell

## What it looks like

```diff
       - run: npm test
+        continue-on-error: true
-      - run: vendor/bin/phpstan analyse
+      # - run: vendor/bin/phpstan analyse
```

```diff
-    "test": "vitest run",
+    "test": "vitest run --passWithNoTests || true",
```

```bash
git commit --no-verify -m "fix tests"
HUSKY=0 git push
```

## Why it hurts

The gate still shows a green check, and it's no longer checking anything. GitHub's workflow syntax describes `continue-on-error: true` on a job as allowing the workflow run to pass when that job fails. On a step, it stops the job from failing when the step fails. `|| true` does the same in any shell. `--no-verify` skips the pre-commit hooks that would have caught the problem locally. No study read for this project measured how often agents do this. It's the pipeline-level version of skipping a test (see [tests-skipped](tests-skipped.md)).

## Fix

CI config and hooks aren't part of the task unless the task says so. If a gate is failing, fix the cause. If you believe the gate itself is wrong, say so in your reply and leave it in place.

## When it's fine

- Deliberately informational jobs (nightly, experimental, an optional linter) that were already non-blocking, or that the user asked to make non-blocking.
- A gate the user explicitly asked you to change. Quote the request.

## How backslop detects it

Review only. Workflow YAML, `package.json`, `composer.json` and `Makefile` aren't scanned languages. When reviewing:
- in `.github/workflows/*`, `.gitlab-ci.yml`, `bitbucket-pipelines.yml`, `.circleci/*` and `azure-pipelines.yml`, look for added `continue-on-error: true`, `allow_failure: true`, `|| true`, `|| exit 0`, `if: false`, `--exit-zero` or `--passWithNoTests`
- look for removed or commented-out `run:` lines that ran tests, lint, type checks or audits
- in package or composer scripts, look for `|| true` or `--passWithNoTests`
- in the transcript, look for `--no-verify`, `HUSKY=0` or `SKIP=`

## Sources

- GitHub Docs, Workflow syntax for GitHub Actions, `jobs.<job_id>.continue-on-error`: https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions
