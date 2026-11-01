import pytest


def test_refund_is_idempotent(client, order):
    first = client.post(f"/orders/{order.id}/refund")
    second = client.post(f"/orders/{order.id}/refund")
    assert first.status_code == 200
    assert second.status_code == 409
    assert order.refunds.count() == 1
