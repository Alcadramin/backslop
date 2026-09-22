def search(q):
    return Product.objects.filter(name__icontains=q)[:20]  # expect: leading-wildcard-like
