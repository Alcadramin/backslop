def charge(gateway, order):
    try:
        gateway.charge(order)
    except PaymentDeclined as exc:
        raise OrderNotPaid(order.id) from exc
    order.status = "paid"
