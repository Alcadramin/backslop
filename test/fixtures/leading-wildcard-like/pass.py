def search(q):
    a = Product.objects.filter(name__istartswith=q)[:20]
    b = Product.objects.filter(metadata__contains={"k": "v"})  # JSON containment, not LIKE
    return a, b
