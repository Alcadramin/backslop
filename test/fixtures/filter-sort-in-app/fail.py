def active_users():
    users = [u for u in User.objects.all() if u.is_active]  # expect: filter-sort-in-app
    ranked = sorted(User.objects.filter(is_staff=True), key=lambda u: u.date_joined)  # expect: filter-sort-in-app
    return users, ranked
