def test_stock(warehouse):
    qty = 3
    warehouse.receive("sku-1", qty)
    assert warehouse.count("sku-1") == qty
