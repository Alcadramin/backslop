from django.db import transaction


def pay(order, requests):
    # `requests` here is a dict argument, not the HTTP library
    with transaction.atomic():
        order.status = "paid"
        order.save()
        token = requests.get("token")
        transaction.on_commit(lambda: notify_erp.delay(order.id))
    send_mail("Paid", "Thanks", None, [order.email])


def outside(order):
    with transaction.atomic():
        order.save()
    import_requests = "requests.post("
