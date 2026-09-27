import itertools


def pull(api, pages, groups):
    rows = []
    for p in pages:
        rows.extend(api.fetch(p))

    more = []
    for p in pages:
        more += api.fetch(p)

    flat = list(itertools.chain.from_iterable(g.items for g in groups))

    # numbers, not lists
    total = 0
    for p in pages:
        total = total + p.size

    # a string, not a list (see string-build-in-loop)
    out = ""
    for p in pages:
        out = out + p.name

    nums = sum([p.size for p in pages])
    return rows, more, flat, total, out, nums
