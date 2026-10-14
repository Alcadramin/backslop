from django.db import transaction


@transaction.atomic
def transfer(src, dst, amount):
    src.balance -= amount
    src.save()
    dst.balance += amount
    dst.save()
