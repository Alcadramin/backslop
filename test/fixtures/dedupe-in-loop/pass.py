def honest(rows):
    seen = set()
    for r in rows:
        seen.update(r.tags)
    all_tags = []
    for r in rows:
        all_tags.extend(r.tags)
    all_tags = list(set(all_tags))
    for r in rows:
        own = list(set(r.tags))
    return seen, all_tags
