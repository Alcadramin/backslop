import pytest

from app.billing.refunds import issue_refund


@pytest.mark.django_db
def test_refund_marks_order(order_factory, fake_gateway):
    order = order_factory(status="paid", total_cents=4200)

    issue_refund(order, amount_cents=4200, gateway=fake_gateway)

    order.refresh_from_db()
    assert order.status == "refunded"
    assert order.refunded_cents == 4200
    assert fake_gateway.refunds == [
        {"order_id": order.id, "amount_cents": 4200, "idempotency_key": f"refund-{order.id}"}
    ]


@pytest.mark.django_db
def test_refund_twice_is_noop(order_factory, fake_gateway):
    order = order_factory(status="paid", total_cents=4200)

    issue_refund(order, amount_cents=4200, gateway=fake_gateway)
    issue_refund(order, amount_cents=4200, gateway=fake_gateway)

    order.refresh_from_db()
    assert order.refunded_cents == 4200
    assert len(fake_gateway.refunds) == 1


@pytest.mark.django_db
def test_refund_over_total_is_rejected(order_factory, fake_gateway):
    order = order_factory(status="paid", total_cents=4200)

    with pytest.raises(ValueError, match="exceeds"):
        issue_refund(order, amount_cents=5000, gateway=fake_gateway)

    assert fake_gateway.refunds == []
