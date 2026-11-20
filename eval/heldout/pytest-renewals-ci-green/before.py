from datetime import date
from decimal import Decimal

import pytest

from app.billing.models import Subscription
from app.billing.renewals import calculate_renewal


@pytest.fixture
def annual_sub():
    return Subscription(
        plan="team-annual",
        seats=5,
        unit_price=Decimal("29.00"),
        renews_on=date(2026, 12, 1),
    )


def test_renewal_applies_seat_count(annual_sub):
    quote = calculate_renewal(annual_sub, as_of=date(2026, 11, 1))

    assert quote.subtotal == Decimal("1740.00")
    assert quote.tax == Decimal("348.00")
    assert quote.currency == "EUR"


def test_renewal_rejects_cancelled_subscription(annual_sub):
    annual_sub.cancelled_at = date(2026, 10, 15)

    with pytest.raises(ValueError, match="cancelled"):
        calculate_renewal(annual_sub, as_of=date(2026, 11, 1))
