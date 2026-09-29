def honest(configuration, users):
    field = next((c for c in configuration if c["name"] == "webhook_endpoint_id"), None)
    has_banned = any(u.banned for u in users)
    banned = [u for u in users if u.banned]
    several = len([u for u in users if u.banned]) > 1
    first_name = [u.name for u in users][0]
    row = users[0]
    return field, has_banned, banned, several, first_name, row
