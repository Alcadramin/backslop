# guard-removed

**An authorization, authentication or validation check was deleted, usually because it made a test or demo fail.**

Severity: medium · Detected by: scanner (diff) · Languages: PHP, TypeScript/JavaScript, Python

## What it looks like

```diff
-Route::middleware(['auth:sanctum', 'can:manage-orders'])->group(function () {
+Route::group([], function () {
     Route::post('/orders/{order}/refund', [OrderController::class, 'refund']);
 });
```

```diff
 public function update(Request $request, Post $post)
 {
-    $this->authorize('update', $post);
     $post->update($request->only('title', 'body'));
```

```diff
-@login_required
 def export_invoices(request):
```

```diff
-router.post('/orders/:id/refund', requireAuth(), async (req, res) => {
+router.post('/orders/:id/refund', async (req, res) => {
```

## Why it hurts

A test got a 403 or a validation error, and the shortest way to green was to delete the check. Now anyone can refund any order. The test still passes, because the test never had a user without permission. The security studies show what follows when agents write code. SusVibes found 61% of SWE-Agent + Claude 4 Sonnet solutions functionally correct but only 10.5% secure. Veracode found 45% of samples from 100+ models introduced OWASP Top 10 flaws, and security "remained flat" as models improved. Neither study separates "removed" from "never added".

## Fix

Put the check back. Make the test set up what the check needs: an authorized user (`actingAs($admin)`), the right permission, valid input. If the check really moved (into a policy, a FormRequest's `authorize()`/`rules()`, a middleware group, a repository method that scopes by user), say where in your reply.

## When it's fine

- The check moved to another file: a parent route group, a base controller, a FormRequest, a middleware, or a framework call that validates for you (`Password::reset`). The scanner can't see other files. In 2,000 commits of real Laravel/Django/TS history, most of its hits were moves like these, which is why it's medium. State the new location.
- The endpoint really became public on purpose. Say who decided.

## How backslop detects it

In diff mode, in production code, the scanner looks for removed lines that hold a check:
- Laravel: `$this->authorize(`, `Gate::`, `->can('...')`, `abort_if/abort_unless(... can/403)`, `middleware('auth'|'can:'|'verified'|'signed'|'password.confirm'|'role:'|'permission:')`, `->validate(`, `Validator::make(`, `@can`
- Django/DRF: `@login_required`, `@permission_required`, `@user_passes_test`, `@staff_member_required`, `@csrf_protect`, `permission_classes =`, `authentication_classes =`, `permissions = (...)`, `has_perm(`, `raise PermissionDenied`, `is_valid(raise_exception=True)`
- Node: `requireAuth(`, `requireUser(`, `isAuthenticated(`, `authorize(`, `checkPermission(`, `verifyToken(`, `getServerSession(`, `@UseGuards(`, `passport.authenticate(`, `authenticatedProcedure`, `status(401|403)`, `schema.parse(req.body)`

It skips the finding when:
- the removed block also removed a function, method or field declaration (the whole handler is gone)
- any line added to the same file looks like a check (a `*permission*`/`*authoriz*`/`*policy*`/`*validat*`/`*accessible*` call, middleware, `Gate::`, `abort_if`, a FormRequest type-hint)
- the removed line was a comment

## Sources

- SusVibes (arXiv 2512.03262 v2): https://arxiv.org/abs/2512.03262v2
- Veracode, 2025 GenAI Code Security Report: https://www.veracode.com/blog/genai-code-security-report/
