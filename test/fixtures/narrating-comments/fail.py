def close_order(order_id):
    # Get the order                                            expect: narrating-comments
    order = Order.objects.get(pk=order_id)

    # Save the order                                           expect: narrating-comments
    order.save()

    return order
