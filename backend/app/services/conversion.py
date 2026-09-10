"""Claim anonymous cloud data for a newly-created or existing account.

Supabase anonymous visitors ("guests") own real rows under their anonymous
uid. When a guest converts, either the same auth.users id is kept (primary
flow: updateUser({email, password})) or, when the email already belongs to a
different account, the guest signs in and we reassign the anonymous rows to
the existing uid via the service-role client (the Supabase `a_id` pattern).

Nested rows (resume_versions, verification_queue) point at resumes by id, so
they ride along automatically when the owning `resumes.user_id` changes.
"""
from typing import Any

from app.services.entitlements import _supabase_client

USER_ID_TABLES = ("resumes", "job_postings", "applications", "analysis_reports", "evidence")
OWNER_ID_TABLES = ("shares",)


def claim_anonymous_rows(from_user_id: str, to_user_id: str) -> dict[str, Any]:
    """Reassign every row owned by ``from_user_id`` to ``to_user_id``.

    Returns {"migrated": {table: count}, "errors": [tables]}.
    """
    sb = _supabase_client()
    if not sb:
        raise RuntimeError("Supabase not configured")

    migrated: dict[str, int] = {}
    errors: list[str] = []

    for table in USER_ID_TABLES:
        try:
            res = (
                sb.table(table)
                .update({"user_id": to_user_id})
                .eq("user_id", from_user_id)
                .execute()
            )
            migrated[table] = len(res.data)
        except Exception:
            errors.append(table)

    for table in OWNER_ID_TABLES:
        try:
            res = (
                sb.table(table)
                .update({"owner_id": to_user_id})
                .eq("owner_id", from_user_id)
                .execute()
            )
            migrated[table] = len(res.data)
        except Exception:
            errors.append(table)

    try:
        sb.table("profiles").delete().eq("id", from_user_id).execute()
    except Exception:
        pass

    return {"migrated": migrated, "errors": errors}