"""Admin audit logging into Supabase (no-op when Supabase is not configured)."""
from datetime import datetime, timezone
from typing import Any

from app.services.entitlements import _supabase_client


def log(
    actor_user_id: str | None = None,
    actor_label: str | None = None,
    action: str = "",
    target_type: str = "",
    target_id: str | None = None,
    before_data: dict[str, Any] | None = None,
    after_data: dict[str, Any] | None = None,
    reason: str | None = None,
    ip: str | None = None,
) -> None:
    sb = _supabase_client()
    if not sb:
        return
    try:
        sb.table("admin_audit_log").insert(
            {
                "actor_user_id": actor_user_id,
                "actor_label": actor_label,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "before_data": before_data,
                "after_data": after_data,
                "reason": reason,
                "ip": ip,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()
    except Exception:
        pass