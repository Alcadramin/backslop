def order_count(user_id, orders):
    n = Order.objects.filter(user_id=user_id).count()
    shown = len(orders)
    first = len(Order.objects.filter(user_id=user_id)[:10])  # sliced: bounded
    label = "len(Order.objects.all())"
    return n, shown, first, label
