def latest(uid, orders):
    a = Order.objects.filter(user_id=uid).order_by("-id").first()
    b = list(orders)[-1]
    c = Order.objects.all()[0]
    return a, b, c
