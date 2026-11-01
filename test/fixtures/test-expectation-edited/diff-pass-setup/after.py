def test_stock(warehouse):
    qty = 4
    warehouse.receive("sku-1", qty)
    assert warehouse.count("sku-1") == qty
