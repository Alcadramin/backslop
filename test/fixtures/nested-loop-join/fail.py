def attach(user_ids):
    users = list(User.objects.filter(id__in=user_ids))
    orders = list(Order.objects.filter(user_id__in=user_ids))
    for user in users:
        user.order_list = [o for o in orders if o.user_id == user.id]  # expect: nested-loop-join
    return users


def pairs(cursor):
    rows = cursor.fetchall()
    invoices = Invoice.objects.all()
    out = []
    for row in rows:
        for invoice in invoices:  # expect: nested-loop-join
            if invoice.customer_id == row[0]:
                out.append((row, invoice))
    return out
