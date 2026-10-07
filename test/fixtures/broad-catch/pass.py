def charge(order):
    try:
        gateway.charge(order)
    except Exception:
        logger.exception("charge failed")
        return False
    try:
        gateway.refund(order)
    except:
        rollback(order)
        raise
    try:
        main()
    except BaseException:
        sys.exit(1)
    text = "except:"
