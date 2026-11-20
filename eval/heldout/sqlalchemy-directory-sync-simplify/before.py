from sqlalchemy import insert, select, update
from sqlalchemy.orm import Session

from app.models import TenantUser


def sync_directory(session: Session, tenant_id: int, idp_users: list[dict]) -> dict:
    existing = set(
        session.scalars(select(TenantUser.email).where(TenantUser.tenant_id == tenant_id))
    )
    new_rows = [
        {"tenant_id": tenant_id, "email": u["email"].lower(), "name": u["name"], "active": True}
        for u in idp_users
        if u["email"].lower() not in existing
    ]
    if new_rows:
        session.execute(insert(TenantUser), new_rows)

    deactivated = deactivate_missing(session, tenant_id, {u["email"].lower() for u in idp_users})
    session.commit()
    return {"created": len(new_rows), "deactivated": deactivated}


def deactivate_missing(session: Session, tenant_id: int, keep_emails: set[str]) -> int:
    result = session.execute(
        update(TenantUser)
        .where(
            TenantUser.tenant_id == tenant_id,
            TenantUser.active.is_(True),
            TenantUser.email.not_in(keep_emails),
        )
        .values(active=False)
    )
    return result.rowcount
