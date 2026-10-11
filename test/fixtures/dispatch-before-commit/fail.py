from django.db import transaction


@transaction.atomic
def refund(order):
    order.status = "refunded"
    order.save()
    send_refund_email.delay(order.id)  # expect: dispatch-before-commit

    def later():
        notify.delay(order.id)  # defined here, runs whenever it is called
    return later


def place_order(data):
    with transaction.atomic():
        order = Order.objects.create(**data)
        process_order.delay(order.id)  # expect: dispatch-before-commit
        send_invoice.apply_async(args=[order.id], countdown=5)  # expect: dispatch-before-commit
    return order
