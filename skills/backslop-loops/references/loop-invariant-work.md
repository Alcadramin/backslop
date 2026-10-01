# loop-invariant-work

**Reading the same file or rebuilding the same lookup on every iteration, when its inputs never change inside the loop.**

Severity: medium · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
foreach ($rows as $r) {
    $map = json_decode(file_get_contents(__DIR__ . '/map.json'), true);   // n file reads
    $banned = array_flip($bannedIds);                                    // undoes the lookup fix
    $out[] = $map[$r['code']] ?? null;
}

$names = array_map(fn ($o) => array_column($users, 'name', 'id')[$o['user_id']] ?? null, $orders);
```

```ts
const kept = rows.filter((r) => !new Set(bannedIds).has(r.userId));   // a new Set per row
for (const r of rows) {
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}
```

```python
kept = [r for r in rows if r.user_id not in set(banned_ids)]          # a new set per row
```

## Why it hurts

Fixed work multiplied by n. A file read per row is n system calls and n JSON parses. Rebuilding a lookup per row (`array_flip`, `array_column`, `new Set`, `set()`) costs O(m) each time, so the loop is O(n·m) again. That's exactly the cost the lookup was supposed to remove. It's a common way for an agent to "fix" `linear-lookup-in-loop` without fixing it.

## Fix

Hoist it. Compute once above the loop and reuse it:

```php
$map = json_decode(file_get_contents(__DIR__ . '/map.json'), true);
$banned = array_flip($bannedIds);
foreach ($rows as $r) { /* ... */ }

$namesById = array_column($users, 'name', 'id');
$names = array_map(fn ($o) => $namesById[$o['user_id']] ?? null, $orders);
```

```ts
const banned = new Set(bannedIds);
const kept = rows.filter((r) => !banned.has(r.userId));
```

## When it's fine

- The value really changes between iterations: a polling loop that re-reads a file on purpose, or a time-dependent value. The scanner skips loops that `sleep`, `usleep`, `setTimeout`, `time.sleep` or `await sleep`.
- **Regexes are mostly a myth here.** PHP's PCRE extension caches up to 4,096 compiled patterns per process (`PCRE_CACHE_SIZE` in `ext/pcre/php_pcre.c`). Python's `re` module caches recent patterns too. Its docs say "programs that use only a few regular expressions at a time needn't worry about compiling regular expressions". A regex literal in a loop is not a recompile per iteration in PHP or Python, so backslop doesn't flag it.
- Cheap constructors (`new DateTimeZone('UTC')`, a formatter). Hoisting them is tidy but rarely matters. They're review-only.
- A builder over constants only (`array_flip(self::TYPES)`, `set(ALLOWED)`): a tiny fixed list. Hoist it if you like. It isn't flagged.

## How backslop detects it

Inside a loop body, the scanner flags these calls when nothing in their arguments changes inside the loop:
- PHP: `file_get_contents`, `file`, `parse_ini_file`, `simplexml_load_file`, `yaml_parse_file`, `array_flip`, `array_fill_keys`, `array_column`, `array_combine`
- JS/TS: `readFileSync`, `new Set(...)`, `new Map(...)`
- Python: `open(...)`, `set(...)`, `frozenset(...)`

"Nothing changes" means the arguments name no loop variable and nothing assigned or mutated in the loop. The arguments also call nothing except path helpers (`__DIR__`, `base_path`, `path.join`, ...).

It skips:
- polling loops
- builders over constants only
- the iterable of a comprehension, which Python evaluates once
- tests, fixtures, seeders and migrations

## Sources

- McConnell, *Code Complete* 2nd ed., ch. 26 "Code-Tuning Techniques" (loops section; exact subsection on hoisting not verified).
- php-src `ext/pcre/php_pcre.c` (`#define PCRE_CACHE_SIZE 4096`): https://github.com/php/php-src/blob/master/ext/pcre/php_pcre.c
- Python docs, `re` module (pattern cache): https://docs.python.org/3/library/re.html
- sonarjs `function-inside-loop`; eslint-plugin-unicorn `consistent-function-scoping` (related).
