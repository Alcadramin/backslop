from django.db.models import Sum


def revenue(orders):
    a = Order.objects.filter(paid=True).aggregate(s=Sum("total"))["s"]
    b = sum(o.total for o in orders)
    c = sum(o.total for o in Order.objects.filter(paid=True)[:20])
    return a, b, c
