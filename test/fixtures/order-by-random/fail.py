def pick():
    a = Product.objects.order_by("?").first()  # expect: order-by-random
    b = session.scalars(select(Product).order_by(func.random()).limit(1))  # expect: order-by-random
    return a, b
