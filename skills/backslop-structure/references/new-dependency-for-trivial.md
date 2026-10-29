# new-dependency-for-trivial

**Adding a package for a few lines of code the language, the runtime or an installed library already provides.**

Severity: medium · Detected by: scanner (static, imports of known micro-packages) + review · Languages: TypeScript/JavaScript, Python (review: PHP)

## What it looks like

```ts
import leftPad from 'left-pad';
import get from 'lodash.get';
import { v4 as uuid } from 'uuid';      // Node has crypto.randomUUID()
import axios from 'axios';              // for one GET, on Node 18+ with global fetch
```

```python
import six                              # a Python 2/3 bridge, in a Python 3 project
```

```json
"require": { "symfony/polyfill-php80": "^1.28" }   // composer.json, while require.php is ">=8.1"
```

## Why it hurts

A dependency is permanent. It brings install weight and transitive packages, plus upgrade work and licence review. It also brings supply-chain exposure: in 2016 the removal of `left-pad`, an 8-line function, from npm broke builds across the Node ecosystem, Babel and React among them (Russ Cox). Agents also invent package names that don't exist. 19.7% of the packages recommended in one large study were hallucinated, and attackers register those names ("slopsquatting"). Every package an agent adds is one more name to check. All of this is to save a line or two.

## Fix

Use the built-in, then remove the package from the manifest and the lockfile.

| package | built-in |
|---|---|
| `left-pad` | `String(n).padStart(8, '0')` |
| `is-odd` / `is-even` | `n % 2 !== 0` / `n % 2 === 0` |
| `is-number` | `typeof x === 'number' && Number.isFinite(x)` |
| `isarray` / `is-array` | `Array.isArray(x)` |
| `object-assign` | `Object.assign` or `{ ...a, ...b }` |
| `array-includes`, `array-flatten`, `array-uniq` | `.includes`, `.flat(Infinity)`, `[...new Set(a)]` |
| `lodash.get` | `obj?.a?.b ?? fallback` |
| `uuid` (v4 only) | `crypto.randomUUID()` (Node 14.17+; browsers in secure contexts) |
| `node-fetch`, `axios` for a plain request | global `fetch` (Node 18+) |
| `six` | Python 3 stdlib directly |

If the project already has a library that does it (`date-fns`, Laravel's Carbon, `httpx`), use that instead of adding a second one.

## When it's fine

- Domain-heavy libraries where hand-rolled code would be worse: time zones, money, crypto, parsing, validation.
- The package is already a transitive dependency and the project now uses it directly, with a version pinned.
- The runtime is older than the built-in (check `engines`, `require.php`, `requires-python`).

Say in the final reply why any new dependency is needed.

## How backslop detects it

The scanner flags imports (`import ... from`, `require()`, dynamic `import()`) of a short list of packages that do one line of work: `left-pad`, `is-odd`, `is-even`, `is-number`, `isarray`, `is-array`, `object-assign`, `array-includes`, `array-flatten`, `array-uniq`, `lodash.get`. In Python it flags `import six` and `from six... import`. Matching is on the exact package name, so `lodash/get`, a local `./left-pad` and similar names are not flagged.

Manifest files (`package.json`, `composer.json`, `requirements.txt`, `pyproject.toml`) are not scanned yet, because the engine only reads PHP/JS/Python files. Review every added manifest line: is it really needed, and does the name exist on the registry (see the fake-done skill)?

## Sources

- Russ Cox, "Our Software Dependency Problem" (dependency risk; the `left-pad` incident): https://research.swtch.com/deps
- Spracklen et al., USENIX Security 2025 (19.7% of 2.23 million recommended packages did not exist): https://arxiv.org/abs/2406.10279
- eslint-plugin-unicorn, `no-unnecessary-polyfills`.
- MDN, `Crypto.randomUUID()`: https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID
