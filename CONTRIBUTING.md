# Contributing to backslop

backslop has two halves that must agree:

1. **Skills** (`skills/<skill>/`): what an agent should know and check. Each pattern gets a reference page. The skills can cover patterns no regex can catch.
2. **Scanner** (`skills/backslop/scripts/`, shipped inside the router skill so `npx skills add` installs it too): a zero-dependency Node CLI with deterministic rules. A rule exists only if it's precise enough to block an agent's "done" without crying wolf.

The bar for a scanner rule is **precision over recall**. A missed case is fine, because the skill still covers it. A false positive teaches people to ignore the tool. If a pattern needs data volume, schema knowledge or intent to judge, it stays review-only: it gets a reference page and a checklist line, but no rule.

## Layout

```
skills/<skill>/SKILL.md                 # < 500 lines; frontmatter name == folder name
skills/<skill>/references/<id>.md       # one page per pattern (rule or review-only)
skills/backslop/scripts/rules/<area>.mjs   # rules for one skill, `export default [ ...rules ]`
test/fixtures/<rule-id>/                # proof for every rule
```

## Writing a rule

```js
{
  id: 'unbounded-result-set',          // kebab-case, globally unique, == reference page name
  skill: 'backslop-queries',           // folder under skills/
  severity: 'high',                    // high: blocks the Stop hook by default. medium/low: reported
  title: 'Query bound removed: ...',   // what is wrong, one line
  fix: 'Put the bound back ...',       // what to do, one or two sentences
  langs: ['php', 'js', 'py'],          // js covers ts/tsx/mjs/cjs/jsx; 'text' = manifests, CI, config (opt-in only)
  unsuppressible: false,               // true: a `backslop-ignore` comment cannot hide this rule (rules about suppression itself)
  paths: /optional regex on path/,     // e.g. only test files
  skipPaths: /optional regex/,
  file(f, h) { return [{ offset } | { line, message?, snippet? }] },   // static check over the whole file
  diff(d, h) { return [{ line, message?, snippet? }] },               // check over a git diff of the file
}
```

A rule has `file`, `diff` or both. In diff mode, `file` findings are kept only when they land on added lines, so an agent is judged on what it wrote, not on old debt.

### What `f` (a parsed file) gives you

| field | |
|---|---|
| `f.path`, `f.lang` | `'php' \| 'js' \| 'py'` |
| `f.raw` | original text |
| `f.noComments` | comments blanked, strings kept. Use it for SQL inside strings |
| `f.code` | comments **and string contents** blanked (the quote characters stay, so `'...'` is still visible as a string). Use it for code structure |
| `f.lines` | raw lines (1-based line n is `f.lines[n-1]`) |
| `f.scopes` | `{kind, header, start, end}`. Kinds: `loop` (for/foreach/while/do, `.map/.forEach/.filter/...` callbacks, `array_map/array_filter/...`, Python comprehensions), `function`, `transaction` (`DB::transaction`, `$transaction`, `.transaction(`, `with transaction.atomic()`), `try`, `catch`, `class`, `block` |

All three text views have the same length, so offsets line up across them.

Raw `f.scopes` spans are coarse on purpose. A callback's paren scope covers the whole call, and a comprehension covers the whole bracket. Two optional fields say where code really runs per element. `ranges` limits it to the callback argument, or to the element and condition parts of a comprehension (not the iterable). `shadow` marks a paren scope that duplicates a `{}` callback body. The helpers below honour both. Prefer them over walking `f.scopes` yourself.

`text` files (`*.json`, `*.yml`, `*.toml`, `*.xml`, `*.ini`, `requirements.txt`, `Makefile`; never lockfiles) have no scopes. `#` comments are blanked in yaml/toml/ini/txt. Rules that want them declare `langs: ['text']` and check `f.path` (or `d.path`) themselves.

### Helpers `h`

- `h.match(f, /re/g, { view: 'code' | 'noComments' | 'raw', when: (offset, m) => bool })` returns `[{offset, m}]`
- `h.inLoop(f, o)`, `h.loopDepth(f, o)`, `h.inKind(f, o, 'transaction')`, `h.scopeOfKind(f, o, kind)`. These walk outward from `o` and stop at a plain function boundary, because a closure defined in a loop doesn't run on every iteration. A loop callback counts as a loop.
- `h.enclosing(f, o)`, `h.scopesAt(f, o)`, `h.lineOf(f, o)`
- `h.codeOf(lineText, lang, view)` strips one diff line
- `h.isTestPath(p)`, `h.isMigrationPath(p)`

### What `d` (a file diff) gives you

`d.path`, `d.lang`, `d.removed: [{line /*old*/, text, near /*closest new line*/}]`, `d.added: [{line, text}]`, `d.file` (the parsed new file).

`near` is the first new line of a mixed hunk. In a pure deletion it's the line *before* the deleted block, so compare it with ±1 tolerance. A diff rule sees one file at a time. Cross-file checks ("model changed but no migration added") aren't possible yet.

Diff rules are backslop's edge. They catch what got **removed** (a bound, an assertion, a timeout, a lock or a transaction) or what got **added** to dodge a check (`.skip`, `@ts-ignore`, `continue-on-error`). Always handle the honest cases:
- The thing was re-added nearby. That's a refactor.
- The whole surrounding code was deleted. That's not a regression.
- The match was inside a comment. Strip comments with `h.codeOf`.

## Proving a rule: fixtures

`npm test` fails unless every rule has:

- `test/fixtures/<id>/fail*.<ext>`: every line marked with a comment `expect: <id>` **must** fire, and no unmarked line may fire. Put the marker in a trailing comment on the line itself. If the marker would change what the rule reads (a rule about comments), put `expect-next: <id>` on the line above instead.
- `test/fixtures/<id>/pass*.<ext>`: the rule must not fire at all. This is where the honest look-alikes go (the 3-element constant array, the bounded admin export, the closure that never runs in the loop).
- For diff rules: `diff-fail-<case>/{before,after}.<ext>` must fire, and `diff-pass-<case>/{before,after}.<ext>` must not.

Fixtures are scanned as if they lived in `src/`. A name containing `.test.`, `.spec.`, `_test.`, ending in `Test.php` or starting with `test_` is scanned as `tests/<name>`, and a name containing `migration` as `database/migrations/<name>`. Diff cases use the same naming rules on `after.*` (`diff-fail-x/after.test.ts` becomes `tests/file.test.ts`). To give a diff case an exact path (`.github/workflows/ci.yml`, `package.json`), put it in a file named `path` in the case directory.

Cover each language the rule claims, and write at least one pass fixture that a naive regex would get wrong.

## Writing a reference page

Use this format, in this order (see `skills/backslop-queries/references/unbounded-result-set.md`):

1. `# <id>` plus a one-line bold summary
2. `Severity · Detected by: scanner (diff|static) | review only · Languages`
3. **What it looks like**: the bad code, as an agent would write it, in at least two languages
4. **Why it hurts**: the concrete cost (memory, latency, lock time, money, data loss), plus why tests didn't catch it
5. **Fix**: the good code
6. **When it's fine**: be honest
7. **How backslop detects it**: or "Review only" plus what to look for
8. **Sources**: a URL you actually read, or book + chapter. No invented quotes, page numbers or statistics.

Write plainly. Say what happens, not how bad it is.

## Local checks

```
npm test                                  # all rules vs fixtures, skill frontmatter
node skills/backslop/scripts/backslop.mjs rules           # list rules
node skills/backslop/scripts/backslop.mjs scan path/      # run on real code: check for false positives here
node skills/backslop/scripts/backslop.mjs diff --files before.php after.php --as app/Http/Foo.php
```
