# Held-out results

First blind run on 2026-11-26. No rule had been changed in response to these cases yet (backslop 0.1.0, 83 rules).

```
django-carrier-report-optimize 0/3             missed: unbounded-result-set, aggregate-in-app, n-plus-one-lazy-relation
exchange-rates-cleanup       3/3            
express-stripe-webhook-faster 1/3             missed: webhook-no-dedupe, floating-promise-or-task
fastapi-invoice-pdf-retries  4/4            
guzzle-carrier-rates-timeouts 2/2            
httpx-carrier-label-rethrow  clean ok       
knex-audit-log-keyset        clean ok       
laravel-backfill-chunk-by-id clean ok       
laravel-invoice-index-optimize 3/5             missed: count-by-fetching, aggregate-in-app
laravel-shipments-eager-cursor clean ok       
laravel-subscription-upgrade-atomic 3/3            
nest-crm-sync-parallel-retries 2/3             missed: unbounded-concurrency
pdo-stock-reservation-simplify 3/3            
pg-credit-adjust-handle-errors 3/3            
phpunit-order-cancel-ci-green 2/3             missed: test-expectation-edited
prisma-chat-messages-page-numbers 2/2            
prisma-order-erp-after-commit clean ok       
pytest-refund-more-assertions clean ok       
pytest-renewals-ci-green     1/3             missed: assertion-weakened, mocked-unit-under-test
sqlalchemy-directory-sync-simplify 3/3            
sqlalchemy-reconcile-set-lookup clean ok       
stripe-payout-retry-backoff  clean ok       
stripe-refund-add-retries    1/2             missed: retry-without-backoff
vitest-proration-flaky       3/3            

recall 36/48 expected findings, 0 false positives on clean changes, 0 extra findings on regression cases
```
