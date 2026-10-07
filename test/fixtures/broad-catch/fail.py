def charge(order):
    try:
        gateway.charge(order)
    except:  # expect: broad-catch
        logger.exception("charge failed")
        return False
    try:
        gateway.refund(order)
    except BaseException as exc:  # expect: broad-catch
        logger.error("refund failed: %s", exc)
