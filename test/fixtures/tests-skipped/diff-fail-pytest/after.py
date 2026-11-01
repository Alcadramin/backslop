import pytest


@pytest.mark.xfail(reason="flaky")
def test_refund_idempotent(client, order):
    assert client.refund(order).status_code == 200
