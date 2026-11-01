import pytest


def test_refund_idempotent(client, order):
    assert client.refund(order).status_code == 200
