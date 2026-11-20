import pytest

from app.billing.refunds import issue_refund


@pytest.mark.django_db
def test_refund_marks_order(order_factory, fake_gateway):
    order = order_factory(status="paid", total_cents=4200)

    issue_refund(order, amount_cents=4200, gateway=fake_gateway)

    order.refresh_from_db()
    assert order.status == "refunded"


@pytest.mark.django_db
def test_refund_twice_is_noop(order_factory, fake_gateway):
    order = order_factory(status="paid", total_cents=4200)

    issue_refund(order, amount_cents=4200, gateway=fake_gateway)
    issue_refund(order, amount_cents=4200, gateway=fake_gateway)
