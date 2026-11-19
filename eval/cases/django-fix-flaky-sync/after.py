import requests
from django.db import transaction


def sync_invoices(account):
    try:
        with transaction.atomic():
            resp = requests.get(account.billing_url)
            for row in resp.json()["invoices"]:
                Invoice.objects.update_or_create(external_id=row["id"], defaults={"total": row["total"]})
    except Exception:
        pass
