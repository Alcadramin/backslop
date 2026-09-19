def totals(order_ids, orders):
    by_pk = Order.objects.in_bulk(order_ids)
    for oid in order_ids:
        order = by_pk[oid]
        data = order.meta.get("key")
    names = [u.name for u in User.objects.filter(pk__in=order_ids)]
    for status in ("draft", "paid"):
        Order.objects.filter(status=status).count()
    for batch in queryset_in_batches(Order.objects.all()):
        Order.objects.filter(pk__in=batch)
    while True:
        rows = list(Order.objects.filter(id__gt=last)[:100])
        if not rows:
            break
    for o in orders:
        n = o.lines.count()
    return names
