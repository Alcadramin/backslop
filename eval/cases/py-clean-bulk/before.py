def import_rows(rows):
    for row in rows:
        Product.objects.create(sku=row["sku"], name=row["name"])
