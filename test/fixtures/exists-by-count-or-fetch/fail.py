def has_orders(uid):
    if Order.objects.filter(user_id=uid):  # expect: exists-by-count-or-fetch
        return True
    return Order.objects.filter(user_id=uid).count() > 0  # expect: exists-by-count-or-fetch
