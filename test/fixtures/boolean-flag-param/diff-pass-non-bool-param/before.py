def export_users(users):
    rows = [serialize(u) for u in users]
    return to_csv(rows)
