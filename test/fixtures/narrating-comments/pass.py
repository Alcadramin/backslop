def close_order(order_id):
    # select_for_update: two workers can close the same order at once.
    order = Order.objects.select_for_update().get(pk=order_id)

    # Update the order
    order.status = "closed"
    order.closed_at = timezone.now()
    order.save()
    return order
