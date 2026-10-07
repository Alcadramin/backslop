def publish(order):
    try:
        broker.publish("orders", order.to_json())
    except Exception as exc:  # expect: catch-log-continue
        logger.error("publish failed: %s", exc)
    order.mark_as_sent()
    return True
