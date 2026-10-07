def to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def find_user(user_id):
    try:
        return User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return None


def load_rates(client):
    try:
        return client.get("/rates").json()
    except Exception:
        logger.exception("rates unavailable")
        return {}
