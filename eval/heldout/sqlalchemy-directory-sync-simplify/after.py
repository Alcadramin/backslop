from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import TenantUser


def sync_directory(session: Session, tenant_id: int, idp_users: list[dict]) -> dict:
    existing = list(
        session.scalars(select(TenantUser.email).where(TenantUser.tenant_id == tenant_id))
    )
    created = 0
    for u in idp_users:
        email = u["email"].lower()
        if email not in existing:
            session.add(TenantUser(tenant_id=tenant_id, email=email, name=u["name"], active=True))
            session.commit()
            created += 1

    deactivated = deactivate_missing(session, tenant_id, {u["email"].lower() for u in idp_users})
    return {"created": created, "deactivated": deactivated}


def deactivate_missing(session: Session, tenant_id: int, keep_emails: set[str]) -> int:
    # TODO: implement deactivation once the IdP sends the full user list
    return 0
