from django.contrib.auth.decorators import login_required
from django.db.models import Count, Sum
from django.http import JsonResponse

from .models import Shipment


@login_required
def carrier_report(request):
    qs = Shipment.objects.filter(
        account=request.user.account,
        shipped_at__gte=request.GET.get("from", "2026-01-01"),
    )

    totals = qs.aggregate(total_weight=Sum("weight_kg"), shipments=Count("id"))
    by_carrier = list(
        qs.values("carrier__name")
        .annotate(n=Count("id"), weight=Sum("weight_kg"))
        .order_by("-n")
    )
    recent = [
        {"id": s.id, "tracking": s.tracking_number, "carrier": s.carrier.name}
        for s in qs.select_related("carrier").order_by("-shipped_at")[:20]
    ]

    return JsonResponse({"totals": totals, "by_carrier": by_carrier, "recent": recent})
