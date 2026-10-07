def get_balance(client, user_id):
    try:
        return client.get(f"/balance/{user_id}").json()["amount"]
    except Exception:  # expect: fallback-that-lies
        return 0


def list_orders(user):
    try:
        return list(Order.objects.filter(user=user))
    except Exception as exc:  # expect: fallback-that-lies
        return []


def count_open(session):
    try:
        return session.query(Order).filter_by(status="open").count()
    except Exception: return 0  # expect: fallback-that-lies
