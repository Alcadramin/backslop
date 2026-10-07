def charge(gateway, order):
    try:
        gateway.charge(order)
    except PaymentDeclined as exc:
        logger.warning("charge declined: %s", exc)
    order.status = "paid"
