import requests
from django.db import transaction


def sync_invoices(account):
    resp = requests.get(account.billing_url, timeout=10)
    resp.raise_for_status()
    with transaction.atomic():
        for row in resp.json()["invoices"]:
            Invoice.objects.update_or_create(external_id=row["id"], defaults={"total": row["total"]})
