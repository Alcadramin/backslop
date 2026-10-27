def export_users(users, delimiter=","):
    rows = [serialize(u) for u in users]
    if delimiter:
        rows = [r for r in rows if r]
    return to_csv(rows, delimiter=delimiter)
