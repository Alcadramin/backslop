import heapq


def honest(xs, groups):
    top = heapq.nlargest(10, xs)
    rows = []
    for g in groups:
        rows.extend(g.items)
    rows.sort(key=lambda r: r.id)
    for g in groups:
        g.items.sort()
        names = sorted(m.name for m in g.members)
    return top, rows, names
