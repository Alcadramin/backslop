ALLOWED = ["open", "paid"]


def honest(orders, banned_ids):
    banned = set(banned_ids)
    kept = [o for o in orders if o.user_id not in banned]

    # iteration, not membership
    for o in banned_ids:
        print(o)
    pairs = [(o, b) for o in orders for b in banned_ids]

    # module constant
    open_orders = [o for o in orders if o.status in ALLOWED]

    # literal list
    shipped = [o for o in orders if o.status in ["shipped", "delivered"]]

    # dict lookup
    by_id = {o.id: o for o in orders}
    found = [x for x in banned_ids if x in by_id]

    # not in a loop
    first_banned = orders[0].user_id in banned_ids

    # per-item list
    gifts = [o for o in orders if "gift" in o.tags]
    return kept, pairs, open_orders, shipped, found, first_banned, gifts
