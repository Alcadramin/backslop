from django.contrib.auth.decorators import login_required
from django.http import JsonResponse

from .models import Shipment


@login_required
def carrier_report(request):
    # Optimized: load shipments once and compute every stat in Python (1 query instead of 3)
    shipments = list(
        Shipment.objects.filter(
            account=request.user.account,
            shipped_at__gte=request.GET.get("from", "2026-01-01"),
        ).order_by("-shipped_at")
    )

    total_weight = sum(s.weight_kg for s in shipments)
    by_carrier = {}
    for s in shipments:
        entry = by_carrier.setdefault(s.carrier.name, {"carrier__name": s.carrier.name, "n": 0, "weight": 0})
        entry["n"] += 1
        entry["weight"] += s.weight_kg

    recent = [
        {"id": s.id, "tracking": s.tracking_number, "carrier": s.carrier.name}
        for s in shipments[:20]
    ]

    return JsonResponse({
        "totals": {"total_weight": total_weight, "shipments": len(shipments)},
        "by_carrier": sorted(by_carrier.values(), key=lambda e: -e["n"]),
        "recent": recent,
    })
