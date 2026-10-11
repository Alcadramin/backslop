from django.db import transaction


def generate_payloads(self, ids):
    # atomic() on the read replica only pins one connection; nothing is written, so there is no commit to wait for
    with transaction.atomic(
        using=settings.DATABASE_CONNECTION_REPLICA_NAME, savepoint=False
    ):
        missing = find_missing(ids)
        if missing:
            generate_deferred_payloads.apply_async(kwargs={"ids": list(missing)})
