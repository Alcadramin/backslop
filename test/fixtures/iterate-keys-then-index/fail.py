def totals(prices, items):
    total = 0
    for i in range(len(items)):  # expect: iterate-keys-then-index
        total += items[i].price
    for sku in prices.keys():  # expect: iterate-keys-then-index
        print(sku, prices[sku])
    return total
