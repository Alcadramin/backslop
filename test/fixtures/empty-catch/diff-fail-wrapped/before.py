def sync_orders(client, orders):
    for order in orders:
        client.push(order)
    return len(orders)
