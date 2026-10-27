def export_users(users, legacy: bool = False):
    rows = [serialize(u) for u in users]
    if legacy:
        rows = [downgrade(r) for r in rows]
    return to_csv(rows)
