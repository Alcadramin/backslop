def test_total(cart):
    assert cart.total(currency="EUR") == 108


def test_lines(cart):
    assert len(cart.lines) == 2


def test_cart_has_owner(cart):
    assert cart.owner is not None
