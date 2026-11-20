import httpx

from app.config import settings


class LabelError(Exception):
    pass


_client = httpx.Client(
    base_url=settings.carrier_api_url,
    timeout=httpx.Timeout(8.0, connect=2.0),
)


def create_label(shipment) -> bytes:
    try:
        resp = _client.post(
            "/labels",
            json={
                "reference": shipment.reference,
                "to": shipment.address.as_dict(),
                "weight_g": shipment.weight_g,
            },
            headers={"Idempotency-Key": f"label-{shipment.id}"},
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise LabelError(
            f"carrier rejected label for shipment {shipment.id}: "
            f"{exc.response.status_code} {exc.response.text[:200]}"
        ) from exc
    except httpx.TransportError as exc:
        raise LabelError(f"carrier unreachable for shipment {shipment.id}") from exc
    return resp.content
