from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Sku, StockMovement

BATCH = 1000


def flag_unknown_skus(session: Session, warehouse_id: int, since_id: int = 0) -> list[int]:
    known = list(session.scalars(select(Sku.code).where(Sku.warehouse_id == warehouse_id)))
    flagged: list[int] = []

    while True:
        movements = session.execute(
            select(StockMovement.id, StockMovement.sku_code)
            .where(StockMovement.warehouse_id == warehouse_id, StockMovement.id > since_id)
            .order_by(StockMovement.id)
            .limit(BATCH)
        ).all()
        if not movements:
            break
        for movement_id, sku_code in movements:
            if sku_code not in known:
                flagged.append(movement_id)
        since_id = movements[-1].id

    return flagged
