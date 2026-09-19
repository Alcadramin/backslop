def has_orders(uid):
    if Order.objects.filter(user_id=uid).exists():
        return True
    n = Order.objects.filter(user_id=uid).count()
    return n
