# checker-suppressed

**A type, lint or scanner error was silenced with an ignore comment or a cast instead of being fixed.**

Severity: medium · Detected by: scanner (diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```ts
// @ts-ignore
const lines = order.lines as any;
// eslint-disable-next-line @typescript-eslint/no-unsafe-return
return lines.reduce((s, l) => s + l.price, 0);
```

```python
user = repo.get(user_id)  # type: ignore
```

```php
/** @phpstan-ignore-next-line */
return $this->repo->find($id)->email;
```

```ts
// backslop-ignore
return prisma.order.findMany();
```

## Why it hurts

The checker was right more often than not. In the PHP example `find()` can return `null`, and PHPStan was saying so. Now the code fatals on a missing user, and the check that would have caught it is off for that line. An ignore comment is the static-analysis version of skipping a test, and it's just as quiet. No AI-specific study measured how often agents do this. It's here because it's the same "make the check pass" move as the documented test hacks, and it's trivial to see in a diff.

## Fix

Fix the cause: narrow the type, null-check, correct the signature, or handle the missing case.

```php
$user = $this->repo->find($id) ?? throw new ModelNotFoundException();
return $user->email;
```

If a suppression is truly needed (a wrong third-party type), make it specific and say why. `@ts-expect-error` is safer than `@ts-ignore`: "if there's no error, TypeScript will report that `// @ts-expect-error` wasn't necessary".

```ts
// @ts-expect-error -- lib types miss the `signal` option (upstream issue #123)
```

## When it's fine

- Third-party typing gaps, generated code, and deliberate `noqa` for a rule that doesn't fit (`# noqa: E501` on a long URL). State it in your reply. That's why this is medium, not high.
- A `backslop-ignore -- reason` written by a human who checked the finding. The scanner still reports an added `backslop-ignore` so a human sees it.

## How backslop detects it

In diff mode, on added lines (comments only, so strings don't count), the scanner flags:
- `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`, `eslint-disable*`, `biome-ignore`, `oxlint-disable`
- `# type: ignore`, `# noqa`, `# pylint: disable`, `# pyright: ignore`
- `@phpstan-ignore*`, `@psalm-suppress`, `phpcs:ignore`
- `backslop-ignore`

It also flags `as any` and `as unknown as` casts in TypeScript, and `cast(Any, x)` in Python. A suppression that only moved isn't flagged.

The engine hides findings on a `backslop-ignore` line and the line after it. A finding about an added `backslop-ignore` is therefore reported on the nearest line the comment doesn't cover, and the message names the comment's own line.

## Sources

- TypeScript 3.9 release notes, `// @ts-expect-error` comments: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html
- ImpossibleBench, for the broader pattern of changing the check instead of the code: https://arxiv.org/abs/2510.20270
