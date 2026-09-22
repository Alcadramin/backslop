def import_prices(rows, stale):
    for r in rows:
        Price.objects.create(**r)  # expect: row-by-row-writes
    for o in stale:
        o.archived = True
        o.save(update_fields=["archived"])  # expect: row-by-row-writes
    for r in rows:
        db.session.add(Price(**r))
        db.session.commit()  # expect: row-by-row-writes
