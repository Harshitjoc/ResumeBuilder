"""Admin API surface — every mutation is role-gated and audited.

All routes require an admin JWT identity (Supabase mode). When Supabase is
not configured the router 503s: admin features have no file-store fallback.
"""
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.deps import AuthContext, require_admin
from app.services import audit
from app.services.entitlements import _supabase_client, set_plan

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])

KNOWN_SETTING_KEYS = {"payment", "quotas", "features", "brand"}


def _sb_or_503():
    sb = _supabase_client()
    if not sb:
        raise HTTPException(status_code=503, detail="Admin endpoints require Supabase")
    return sb


class PlanUpdate(BaseModel):
    plan: str
    months: int | None = None


class BanUpdate(BaseModel):
    banned: bool
    reason: str | None = None


class SettingsUpdate(BaseModel):
    payment: dict[str, Any] | None = None
    quotas: dict[str, Any] | None = None
    features: dict[str, Any] | None = None
    brand: dict[str, Any] | None = None


@router.get("/users")
async def list_users(limit: int = 50, search: str | None = None, role: str | None = None):
    sb = _sb_or_503()
    q = sb.table("profiles").select("id,full_name,role,plan,plan_expires_at,created_at,updated_at")
    if role in ("user", "admin", "banned"):
        q = q.eq("role", role)
    if search:
        q = q.or_(f"full_name.ilike.%{search}%")
    res = q.limit(min(limit, 200)).order("created_at", desc=True).execute()
    return {"users": res.data}


@router.get("/users/{user_id}")
async def user_detail(user_id: str):
    sb = _sb_or_503()
    res = sb.table("profiles").select("id,full_name,role,plan,plan_expires_at,created_at,updated_at").eq("id", user_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": res.data[0]}


def _audit(ctx: AuthContext, action: str, target_type: str, target_id: str, before=None, after=None, reason: str | None = None, ip: str | None = None):
    audit.log(
        actor_user_id=ctx.user_id,
        actor_label=ctx.user_id or "admin",
        action=action,
        target_type=target_type,
        target_id=target_id,
        before_data=before,
        after_data=after,
        reason=reason,
        ip=ip,
    )


@router.post("/users/{user_id}/plan")
async def set_user_plan(user_id: str, body: PlanUpdate, ctx: AuthContext = Depends(require_admin)):
    sb = _sb_or_503()
    res = sb.table("profiles").select("id,plan,plan_expires_at").eq("id", user_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    before = res.data[0]
    if body.plan not in ("free", "pro"):
        raise HTTPException(status_code=400, detail="plan must be 'free' or 'pro'")
    if body.plan == "pro":
        months = body.months or int(_setting_or(sb, "payment", "subscription_months", 12))
        expires = set_plan(user_id, user_id, "pro", months)
        after = {"plan": "pro", "plan_expires_at": expires}
    else:
        expires = datetime.now(timezone.utc).isoformat()
        sb.table("profiles").update({"plan": "free", "plan_expires_at": expires}).eq("id", user_id).execute()
        after = {"plan": "free", "plan_expires_at": expires}
    _audit(ctx, "plan.set", "user", user_id, before_data=before, after_data=after, reason=f"set plan to {body.plan}")
    return {"ok": True, **after}


@router.post("/users/{user_id}/ban")
async def set_user_ban(user_id: str, body: BanUpdate, ctx: AuthContext = Depends(require_admin)):
    sb = _sb_or_503()
    res = sb.table("profiles").select("id,role").eq("id", user_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    before = res.data[0]
    new_role = "banned" if body.banned else "user"
    sb.table("profiles").update({"role": new_role}).eq("id", user_id).execute()
    after = {"role": new_role}
    _audit(ctx, "ban.set" if body.banned else "ban.clear", "user", user_id, before_data=before, after_data=after, reason=body.reason)
    return {"ok": True, "role": new_role}


@router.post("/users/{user_id}/delete")
async def delete_user(user_id: str, ctx: AuthContext = Depends(require_admin)):
    sb = _sb_or_503()
    res = sb.table("profiles").select("id,role,plan").eq("id", user_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    _audit(ctx, "user.delete", "user", user_id, before_data=res.data[0])
    # The profile row is removed; removing the auth.users account itself is a
    # separate administrative step (Supabase Auth user management).
    sb.table("profiles").delete().eq("id", user_id).execute()
    return {"ok": True}


@router.get("/settings")
async def get_settings():
    sb = _sb_or_503()
    res = sb.table("system_settings").select("key,value").execute()
    return {"settings": {row.get("key"): row.get("value") for row in res.data}}


@router.put("/settings")
async def update_settings(body: SettingsUpdate, ctx: AuthContext = Depends(require_admin)):
    sb = _sb_or_503()
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(status_code=400, detail="No settings provided")
    for key, value in payload.items():
        if key not in KNOWN_SETTING_KEYS:
            raise HTTPException(status_code=400, detail=f"Unknown setting key: {key}")
        sb.table("system_settings").upsert({"key": key, "value": value}, on_conflict="key").execute()
    _audit(ctx, "settings.update", "system_settings", None, after_data=payload)
    res = sb.table("system_settings").select("key,value").execute()
    return {"settings": {row.get("key"): row.get("value") for row in res.data}}


@router.get("/kpis")
async def get_kpis():
    sb = _sb_or_503()
    today = datetime.now(timezone.utc).date().isoformat()
    kpis: dict[str, Any] = {k: 0 for k in ("totalUsers", "proUsers", "pendingPayments", "todayLlmCalls")}
    try:
        kpis["totalUsers"] = sb.table("profiles").select("id", count="exact").execute().count or 0
        kpis["proUsers"] = sb.table("profiles").select("id", count="exact").eq("plan", "pro").execute().count or 0
        kpis["pendingPayments"] = sb.table("plan_requests").select("id", count="exact").eq("status", "pending").execute().count or 0
        usage = sb.table("usage_logs").select("calls").eq("day", today).execute()
        kpis["todayLlmCalls"] = sum(row.get("calls") or 0 for row in usage.data)
    except Exception:
        pass
    return {"kpis": kpis}


@router.get("/audit")
async def get_audit(limit: int = 50):
    sb = _sb_or_503()
    res = sb.table("admin_audit_log").select("*").limit(min(limit, 200)).order("created_at", desc=True).execute()
    return {"logs": res.data}


def _setting_or(sb, key: str, field: str, default: Any) -> Any:
    try:
        res = sb.table("system_settings").select("value").eq("key", key).limit(1).execute()
        if res.data:
            value = res.data[0].get("value") or {}
            return value.get(field, default)
    except Exception:
        pass
    return default