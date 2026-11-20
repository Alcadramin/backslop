from collections.abc import Iterator

from sqlalchemy import Row, select
from sqlalchemy.orm import Session

from app.models import Sku, StockMovement

BATCH = 1000


def _movement_batches(session: Session, warehouse_id: int, since_id: int) -> Iterator[list[Row]]:
    while True:
        batch = session.execute(
            select(StockMovement.id, StockMovement.sku_code)
            .where(StockMovement.warehouse_id == warehouse_id, StockMovement.id > since_id)
            .order_by(StockMovement.id)
            .limit(BATCH)
        ).all()
        if not batch:
            return
        yield batch
        since_id = batch[-1].id


def flag_unknown_skus(session: Session, warehouse_id: int, since_id: int = 0) -> list[int]:
    known = set(session.scalars(select(Sku.code).where(Sku.warehouse_id == warehouse_id)))
    return [
        movement_id
        for batch in _movement_batches(session, warehouse_id, since_id)
        for movement_id, sku_code in batch
        if sku_code not in known
    ]
