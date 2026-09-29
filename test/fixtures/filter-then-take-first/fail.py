def finders(configuration, users):
    field = [c for c in configuration if c["name"] == "webhook_endpoint_id"][0]  # expect: filter-then-take-first
    has_banned = len([u for u in users if u.banned]) > 0  # expect: filter-then-take-first
    return field, has_banned
