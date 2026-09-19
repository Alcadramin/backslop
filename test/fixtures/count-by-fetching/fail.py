def order_count(user_id):
    n = len(Order.objects.filter(user_id=user_id))  # expect: count-by-fetching
    m = len(list(Order.objects.all()))  # expect: count-by-fetching
    return n + m
