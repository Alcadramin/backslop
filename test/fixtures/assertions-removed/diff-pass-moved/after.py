def test_total(cart):
    cart.add("sku-1")
    assert cart.count() == 1
    assert cart.total() == 108 + cart.lines[0].price
