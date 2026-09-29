def honest(prices, items):
    total = 0
    for i, item in enumerate(items):
        total += item.price
    # looks at neighbours: the index is needed
    for i in range(len(items)):
        if i + 1 < len(items) and items[i + 1].price < items[i].price:
            print(i)
    # writes back through the index
    for i in range(len(items)):
        items[i] = normalize(items[i])
    # only keys used
    for sku in prices.keys():
        print(sku)
    return total
