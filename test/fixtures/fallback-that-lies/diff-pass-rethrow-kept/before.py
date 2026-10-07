def load(client, key):
    try:
        return client.get(key)
    except KeyError:
        raise
