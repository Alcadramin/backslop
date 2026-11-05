# hallucinated-package

**A dependency was added that doesn't exist, or that exists only because someone registered the name an AI tends to invent.**

Severity: high · Detected by: review only · Languages: any package manifest

## What it looks like

```diff
// package.json
+    "express-validator-helpers": "^1.2.0",
```

```diff
# requirements.txt
+flask-jwt-simple-auth
```

```diff
// composer.json
+    "laravel/stripe-payments": "^2.0",
```

The manifest changed and the lockfile didn't, so the install never ran. Or the lockfile has an entry for a package first published days ago, with no repository link.

## Why it hurts

If the name doesn't exist, the install fails in CI or on the next machine. If an attacker registered it, you install their code. Spracklen et al. (USENIX Security 2025) generated 576,000 code samples from 16 models and found 19.7% of the 2.23 million recommended packages didn't exist. The average was 5.2% for commercial models and 21.7% for open-source ones. 43% of the invented names came back in all 10 re-runs of the same prompt, which is what makes registering them in advance ("slopsquatting") practical.

## Fix

Add only packages you've confirmed on the registry, with real history: downloads, a repository, maintainers. Install them, so the lockfile changes in the same diff. Prefer what's already installed.

## When it's fine

Workspace and monorepo packages, private registries and path dependencies. Those don't exist on the public registry by design.

## How backslop detects it

Review only. Manifests and lockfiles aren't scanned languages. When reviewing, check that every new manifest entry has a lockfile entry in the same diff. Then look up anything unfamiliar: `npm view <name> time.created`, `https://pypi.org/pypi/<name>/json`, `https://repo.packagist.org/p2/<vendor>/<name>.json`. For dependencies that exist but aren't needed, see [backslop-structure](../../backslop-structure/).

## Sources

- Spracklen et al. (USENIX Security 2025), package hallucinations: https://arxiv.org/abs/2406.10279
- Socket, on slopsquatting: https://socket.dev/blog/slopsquatting-how-ai-hallucinations-are-fueling-a-new-class-of-supply-chain-attacks
