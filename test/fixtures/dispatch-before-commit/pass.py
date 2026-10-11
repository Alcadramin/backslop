from functools import partial

from django.db import transaction


def place_order(data):
    with transaction.atomic():
        order = Order.objects.create(**data)
        transaction.on_commit(lambda: process_order.delay(order.id))
        transaction.on_commit(
            partial(send_invoice.apply_async, args=[order.id])
        )
        transaction.on_commit(
            lambda: send_receipt.delay(
                order.id,
            )
        )
    notify.delay(order.id)
    return order
