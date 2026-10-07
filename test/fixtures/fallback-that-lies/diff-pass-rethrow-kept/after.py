def load(client, key):
    try:
        return client.get(key)
    except KeyError:
        metrics.incr("load_miss")
        raise
