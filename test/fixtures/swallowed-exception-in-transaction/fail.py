import logging

from django.db import IntegrityError, transaction

log = logging.getLogger(__name__)


def place(data, items):
    with transaction.atomic():
        order = Order.objects.create(**data)
        try:
            Item.objects.bulk_create(items)
        except IntegrityError:  # expect: swallowed-exception-in-transaction
            log.exception("items")
        try:
            order.coupon.save()
        except Exception as e:  # expect: swallowed-exception-in-transaction
            log.warning("coupon %s", e)
    return order
