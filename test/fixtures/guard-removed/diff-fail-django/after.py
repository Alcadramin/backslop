from django.contrib.auth.decorators import login_required


def export_invoices(request):
    return render_csv(Invoice.objects.filter(owner=request.user))
