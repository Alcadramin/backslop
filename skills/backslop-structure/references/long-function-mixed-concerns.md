# long-function-mixed-concerns

**One function that validates, queries, computes, formats, sends mail and logs.**

Severity: medium · Detected by: review only · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

Agents grow functions by appending, because appending is the safest local edit.

```php
public function checkout(Request $r)
{
    // 30 lines of validation, 40 of pricing, 30 of charging, 30 of mail, 10 of logging
}
```

```ts
app.post('/checkout', async (req, res) => {
  /* parse body, three queries, totals, Stripe call, email template, res.json */
});
```

## Why it hurts

You can't test or reuse the pricing without a request, a database and a mailer. A change to one concern risks the others, and a reviewer can't tell which lines the change was about. Error handling gets tangled too: a mail failure ends up rolling back, or not rolling back, a payment.

## Fix

Split by concern, not by line count (Fowler's *Split Phase*): parse the input, compute, then act.

```php
$input   = CheckoutInput::fromRequest($r);
$quote   = $this->pricing->quote($input);
$payment = $this->payments->charge($quote);
$this->mailer->receipt($payment);
```

Ousterhout's counterweight: don't break it into many shallow two-line functions that the reader has to chase. Each extracted piece should hide something real.

## When it's fine

- Long but single-purpose: a big `match` table, a mapping, a migration, a script meant to be read top to bottom.
- A thin controller action that is long only because it lists many fields.

## How backslop detects it

Review only. Count the concerns, not the lines: input parsing, database, HTTP, money arithmetic, rendering, mail, file I/O, logging. Three or more in one function, or nesting deeper than four, means it should be split. Length and complexity metrics are in PHPMD, PHP_CodeSniffer, sonarjs, ESLint `complexity` and Ruff `C901`/`PLR0915`.

## Sources

- Fowler, *Refactoring* 2nd ed., ch. 3 (Long Function); *Extract Function*: https://refactoring.com/catalog/extractFunction.html; *Split Phase*: https://refactoring.com/catalog/splitPhase.html
- Ousterhout, *A Philosophy of Software Design* (1st ed.), ch. 9 "Better Together Or Better Apart?".
- Hunt & Thomas, *The Pragmatic Programmer* 20th anniv. ed., Topic 10 "Orthogonality".
