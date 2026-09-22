import random


def pick(ids):
    return Product.objects.filter(pk=random.choice(ids)).first()
