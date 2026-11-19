def import_rows(rows, batch_size=1000):
    Product.objects.bulk_create(
        [Product(sku=row["sku"], name=row["name"]) for row in rows],
        batch_size=batch_size,
    )
