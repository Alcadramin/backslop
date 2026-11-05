# secrets-or-pii-logged

**A password, token, API key, cookie or authorization header is passed to a log or print call.**

Severity: high · Detected by: scanner (static) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

Added while debugging, and never removed:

```ts
console.log('login', user.password);
logger.info(`issued token=${token}`);
logger.debug({ auth: req.headers.authorization });
```

```php
Log::info("Login with password $password");
logger()->debug('stripe', ['key' => $apiKey]);
```

```python
logging.info(f"user={user.id} token={token}")
print(api_key)
```

## Why it hurts

Logs are copied to log services, shared in tickets and kept for months, often with wider access than the database. A token in a log line is a token anyone with log access can use. OWASP's Logging Cheat Sheet lists what "should usually not be recorded directly in the logs", including "Access tokens", "Authentication passwords" and "Session identification values". No AI-specific study measured this. It's here because debug logging is something agents add while fixing a failing flow.

## Fix

Log an id and the outcome, not the secret.

```ts
logger.info('token issued', { userId: user.id, tokenId: token.id });
```

If you need to correlate, log a hash or the last 4 characters. Remove debug prints before you finish.

## When it's fine

- The value is redacted on the same line (`mask(token)`, `token.length`, `'***'`, a hash). Not flagged.
- Metadata about a secret: `tokenId`, `hasPassword`, `maxTokens`, `nextPageToken`, `apiToken.user.id`. Not flagged.
- "Token" that isn't a credential: a lexer token, or an LLM token count. Some apps use public "tokens" as identifiers (a checkout token, for example). The scanner skips `x.token` unless `x` looks auth-related. If the token grants access to anything, it's a credential.

## How backslop detects it

The scanner finds log and print calls in production code:
- JS: `console.*`, `logger.*`, `log.*`, `this.logger.*`
- PHP: `Log::*`, `logger()->*`, `$this->logger->*`, `error_log`, `var_dump`, `print_r`, `dump`, `dd`, `info`
- Python: `print`, `logging.*`, `logger.*`, `log.*`, `self.logger.*`

Inside the call's arguments it looks at what is actually evaluated:
- code outside strings
- `${...}` in template literals
- `{...}` in f-strings
- `$var` in PHP double-quoted strings

It reports an identifier whose last word is `password`, `secret`, `token`, `apiKey`, `authorization`, `cookie`, `credentials`, `bearer`, `jwt`, `privateKey` or `clientSecret`. It skips a few cases:
- metadata names: `maxTokens`, `hasPassword`, `nextPageToken`, `csrfToken`
- object keys
- fields read through the secret (`apiToken.user.id`)
- a plain `.token` on an object that isn't auth-shaped (`checkout.token`, `transaction_item.token`: many models use "token" as a public id). `session.token` and `oauth.token` still count.
- calls whose arguments mask, hash or measure the value

Words inside plain strings (`'Password reset email sent'`) are ignored.

## Sources

- OWASP Logging Cheat Sheet, "Data to exclude": https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
