from django.db import transaction


def reserve(product_id, qty):
    with transaction.atomic():
        p = Product.objects.select_for_update().get(pk=product_id)
        p.stock -= qty
        p.save(update_fields=["stock"])


def other():
    return 1
