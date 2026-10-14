from django.db import transaction


def transfer(src, dst, amount):
    src.balance -= amount
    src.save()
    dst.balance += amount
    dst.save()
