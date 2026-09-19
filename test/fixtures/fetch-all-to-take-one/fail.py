def latest(uid):
    return list(Order.objects.filter(user_id=uid))[-1]  # expect: fetch-all-to-take-one
