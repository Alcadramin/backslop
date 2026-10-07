def save(u):
    try:
        return db.save(u)
    except IntegrityError:
        raise
    except Exception as exc:
        raise SaveFailed(u.id) from exc


def load(key):
    try:
        return db.load(key)
    except KeyError as e:
        raise LookupFailed(key) from e
