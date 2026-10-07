def save(u):
    try:
        return db.save(u)
    except Exception as e:  # expect: catch-rethrow-same
        raise e


def load(key):
    try:
        return db.load(key)
    except KeyError:  # expect: catch-rethrow-same
        raise
