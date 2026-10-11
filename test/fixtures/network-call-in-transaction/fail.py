import requests
from django.core.mail import send_mail
from django.db import transaction


def pay(order):
    with transaction.atomic():
        order.status = "paid"
        order.save()
        requests.post("https://erp.example.com/orders", json={"id": order.id}, timeout=5)  # expect: network-call-in-transaction
        send_mail("Paid", "Thanks", None, [order.email])  # expect: network-call-in-transaction


async def sync(session, order):
    async with session.begin():
        session.add(order)
        stripe.Refund.create(charge=order.charge_id)  # expect: network-call-in-transaction
