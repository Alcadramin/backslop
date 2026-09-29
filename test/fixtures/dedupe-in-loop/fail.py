def collect(rows):
    tags = []
    for r in rows:
        tags = list(set(tags + r.tags))  # expect: dedupe-in-loop
    return tags
