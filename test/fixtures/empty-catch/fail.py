def commit_order(session, order):
    try:
        session.add(order)
        session.commit()
    except Exception:  # expect: empty-catch
        pass
    try:
        notify(order)
    except:  # expect: empty-catch
        ...
    try:
        audit(order)
    except BaseException: pass  # expect: empty-catch
