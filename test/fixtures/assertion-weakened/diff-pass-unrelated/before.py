def test_total(cart):
    assert cart.total() == 108


def test_lines(cart):
    assert len(cart.lines) == 2
