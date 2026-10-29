# narrating-comments

**Comments that repeat the next line, or that describe the edit instead of the code.**

Severity: low · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```php
// Get the invoice by id
$invoice = $this->invoices->find($id);

// Loop through the lines
foreach ($invoice->lines as $line) {

// Added null check to fix the crash on empty invoices
if ($invoice->customer === null) {
```

```ts
// Changed to use findUniqueOrThrow instead of findUnique
const order = await prisma.order.findUniqueOrThrow({ where: { id } });
// Return the order
return order;
```

```python
# Save the order
order.save()
```

## Why it hurts

A comment that repeats the code costs reading time and tells the reader nothing. It also goes stale: the code changes and the comment doesn't. A comment about the edit ("Added", "Changed to", "as requested") is about the conversation that produced the code. It means nothing to the next reader and belongs in the commit message. These comments also crowd out the ones that matter, so readers learn to skip comments.

## Fix

Delete it. If something isn't obvious from the code, write that instead: the reason, the units, an invariant, a workaround and its ticket.

```php
// find() bypasses the soft-delete scope on purpose: support staff can view deleted invoices.
$invoice = $this->invoices->find($id);
```

## When it's fine

- Section headers in a long config or data file.
- Comments that explain a regex, a SQL query, or a non-obvious API.
- Step labels in tests and scripts that read top to bottom.
- Public API docblocks that add information the signature lacks: units, ranges, thrown exceptions.

## How backslop detects it

Two checks, both on single-line comments that sit alone, not inside a comment block.

1. **The comment describes the edit.** It starts with `Added`, `Updated`, `Changed`, `Fixed`, `Modified`, `Refactored` or `Replaced`, followed within a few words by `to fix`, `to handle`, `to support`, `to avoid`, `to ensure`, `to prevent` or `instead of`. Or it says `as requested`, `per your request` or `as you asked`.
2. **The comment repeats the next line.** All of these must hold:
   - It is 2 to 6 words, starts with a plain verb (`Get`, `Set`, `Create`, `Save`, `Send`, `Return`, `Validate`, `Loop through`, ...) and has no punctuation or code references.
   - Every content word in it is an identifier in the next line, after splitting camelCase and snake_case and ignoring plurals.
   - It heads exactly one statement: the line after next is blank, a closing bracket or another comment.
   - "Loop/Iterate through X" counts only above a loop. It is the one case allowed to head a block.

Test files are skipped for the second check.

## Sources

- Ousterhout, *A Philosophy of Software Design* (1st ed.), ch. 13 "Comments Should Describe Things that Aren't Obvious from the Code" (§13.2 "Don't repeat the code").
- Fowler, *Refactoring* 2nd ed., ch. 3 (Comments).
