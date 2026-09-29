def top_ten(xs):
    top = []
    for x in xs:
        top.append(x)
        top.sort()  # expect: sort-in-loop
        top = top[-10:]
    return top


def merged(chunks):
    rows = []
    for c in chunks:
        rows.extend(c)
        rows = sorted(rows, key=lambda r: r.id)  # expect: sort-in-loop
    return rows
