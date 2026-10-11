from django.db import transaction


def place_order(data):
    order = Order.objects.create(**data)
    process_order.delay(order.id)
    return order
