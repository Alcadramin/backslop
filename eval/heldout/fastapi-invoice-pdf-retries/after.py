import requests
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.auth import current_user
from app.config import settings

router = APIRouter()

MAX_ATTEMPTS = 5


@router.get("/invoices/{invoice_id}/pdf")
async def invoice_pdf(invoice_id: int, user=Depends(current_user)):
    if not user.can_view_invoice(invoice_id):
        raise HTTPException(status_code=404)

    url = f"{settings.renderer_url}/render/invoices/{invoice_id}.pdf"
    for attempt in range(MAX_ATTEMPTS):
        try:
            resp = requests.get(url)
            resp.raise_for_status()
            return Response(content=resp.content, media_type="application/pdf")
        except requests.RequestException:
            continue

    raise HTTPException(status_code=502, detail="renderer unavailable")
