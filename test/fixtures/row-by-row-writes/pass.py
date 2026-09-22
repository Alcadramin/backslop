def import_prices(rows, images):
    Price.objects.bulk_create([Price(**r) for r in rows], batch_size=1000)
    Order.objects.filter(status="stale").update(archived=True)
    for img in images:
        img.save(buffer, format="PNG")  # an image file, not a row
    for form in forms:
        form.save(commit=False)
    for batch in chunked(rows, 500):
        Price.objects.bulk_create(batch)
    for i, row in enumerate(rows):
        row.position = i
        row.save()
