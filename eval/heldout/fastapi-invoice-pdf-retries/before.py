import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from app.auth import current_user
from app.config import settings

router = APIRouter()
renderer = httpx.AsyncClient(
    base_url=settings.renderer_url,
    timeout=httpx.Timeout(10.0, connect=2.0),
)


@router.get("/invoices/{invoice_id}/pdf")
async def invoice_pdf(invoice_id: int, user=Depends(current_user)):
    if not user.can_view_invoice(invoice_id):
        raise HTTPException(status_code=404)

    req = renderer.build_request("GET", f"/render/invoices/{invoice_id}.pdf")
    resp = await renderer.send(req, stream=True)
    if resp.status_code != 200:
        await resp.aclose()
        raise HTTPException(status_code=502, detail="renderer unavailable")

    return StreamingResponse(
        resp.aiter_bytes(),
        media_type="application/pdf",
        background=BackgroundTask(resp.aclose),
    )
