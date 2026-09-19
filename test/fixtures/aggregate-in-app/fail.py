def revenue():
    return sum(o.total for o in Order.objects.filter(paid=True))  # expect: aggregate-in-app
