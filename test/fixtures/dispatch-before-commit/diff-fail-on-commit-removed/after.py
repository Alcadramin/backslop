from django.db import transaction


def place_order(data):
    with transaction.atomic():
        order = Order.objects.create(**data)
        process_order.delay(order.id)
    return order
