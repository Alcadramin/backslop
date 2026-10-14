from django.db import transaction


def reserve(product_id, qty):
    with transaction.atomic():
        p = Product.objects.get(pk=product_id)
        p.stock -= qty
        p.save(update_fields=["stock"])
