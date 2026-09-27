def visible(orders, banned_ids: list[int]):
    return [o for o in orders if o.user_id not in banned_ids]  # expect: linear-lookup-in-loop


def tagged(rows):
    ids = [r.id for r in rows]
    out = []
    for r in rows:
        if r.parent_id in ids:  # expect: linear-lookup-in-loop
            out.append(r)
    return out


def variants_in_stock(variants, stocks):
    variant_ids = list(stocks.values_list("variant_id", flat=True))
    return [v for v in variants if v.pk in variant_ids]  # expect: linear-lookup-in-loop
