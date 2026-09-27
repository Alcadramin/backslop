from collections import defaultdict


def attach(user_ids, fields, columns):
    users = list(User.objects.filter(id__in=user_ids))
    orders = list(Order.objects.filter(user_id__in=user_ids))
    by_user = defaultdict(list)
    for o in orders:
        by_user[o.user_id].append(o)
    for user in users:
        user.order_list = by_user[user.id]

    # child collection
    for user in users:
        for address in user.addresses:
            if address.id == user.default_address_id:
                user.default = address

    # small lists passed in: review
    for f in fields:
        for c in columns:
            if c.name == f.name:
                print(c)

    # index loops
    for i in range(len(users)):
        for j in range(len(orders)):
            if users[i].id == orders[j].user_id:
                print(i, j)
    return users
