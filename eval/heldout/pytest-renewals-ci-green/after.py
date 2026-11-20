from datetime import date
from decimal import Decimal
from unittest.mock import patch

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

    assert quote.subtotal == Decimal("1450.00")
    assert quote.tax is not None
    assert quote.currency == "EUR"


@patch("app.billing.renewals.calculate_renewal")
def test_renewal_rejects_cancelled_subscription(mock_calculate, annual_sub):
    mock_calculate.side_effect = ValueError("subscription cancelled")
    annual_sub.cancelled_at = date(2026, 10, 15)

    with pytest.raises(ValueError, match="cancelled"):
        mock_calculate(annual_sub, as_of=date(2026, 11, 1))
