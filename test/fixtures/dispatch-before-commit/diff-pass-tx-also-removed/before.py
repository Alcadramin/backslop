from django.db import transaction


def place_order(data):
    with transaction.atomic():
        order = Order.objects.create(**data)
        transaction.on_commit(lambda: process_order.delay(order.id))
    return order
