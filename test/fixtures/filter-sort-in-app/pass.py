def active_users(users):
    a = User.objects.filter(is_active=True).order_by("-date_joined")[:20]
    b = [u for u in users if u.is_active]
    c = [u.email for u in User.objects.filter(is_active=True)]
    d = sorted(User.objects.filter(is_active=True)[:20], key=lambda u: u.name)
    return a, b, c, d
