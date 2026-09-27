def pull(api, pages):
    rows = []
    for p in pages:
        rows = rows + api.fetch(p)  # expect: accumulate-by-copy-in-loop
    return rows


def flatten(groups):
    return sum([g.items for g in groups], [])  # expect: accumulate-by-copy-in-loop
