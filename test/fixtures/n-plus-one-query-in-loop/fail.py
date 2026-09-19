def totals(order_ids, orders):
    for oid in order_ids:
        order = Order.objects.get(pk=oid)  # expect: n-plus-one-query-in-loop
    names = [User.objects.get(pk=o.user_id).name for o in orders]  # expect: n-plus-one-query-in-loop
    for o in orders:
        lines = o.orderline_set.filter(active=True)  # expect: n-plus-one-query-in-loop
        row = session.execute(select(Line).where(Line.order_id == o.id))  # expect: n-plus-one-query-in-loop
    return names
