def entries(request):
    qs = Entry.objects.select_related("blog").filter(published=True)[:50]
    return [(e.title, e.blog.name) for e in qs]
