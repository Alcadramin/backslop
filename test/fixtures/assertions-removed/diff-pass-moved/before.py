def test_total(cart):
    assert cart.total() == 108
    cart.add("sku-1")
    assert cart.count() == 1
