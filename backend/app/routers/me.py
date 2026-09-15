from fastapi import APIRouter, Depends, Header, HTTPException

from app.deps import AuthContext, get_user_http, require_user, supabase_enabled
from app.services import audit
from app.services.entitlements import get_cached, _supabase_client

router = APIRouter(tags=["me"])


def _profile_role(user_id: str | None) -> str | None:
    if not user_id:
        return None
    sb = _supabase_client()
    if not sb:
        return None
    try:
        res = sb.table("profiles").select("role").eq("id", user_id).limit(1).execute()
        return res.data[0].get("role") if res.data else None
    except Exception:
        return None


@router.get("/api/me")
async def get_me(
    auth: AuthContext = Depends(get_user_http),
    x_client_key: str | None = Header(None),
):
    cached = get_cached(auth.user_id, auth.identity_key or x_client_key)
    from app.services.entitlements import get_feature_flags

    return {
        "plan": cached["plan"],
        "planExpiresAt": cached["planExpiresAt"],
        "quotaRemaining": cached["quotaRemaining"],
        "quotaLimit": cached["quotaLimit"],
        "quotaUnlimited": cached["quotaUnlimited"],
        "clientKey": auth.client_key or "",
        "user_id": auth.user_id or "",
        "is_anonymous": auth.is_anonymous,
        "role": _profile_role(auth.user_id),
        "features": get_feature_flags(),
    }


@router.post("/api/account/delete")
async def delete_account(ctx: AuthContext = Depends(require_user)):
    """Permanently delete the signed-in account and all owned rows.

    Uses the service-role key to remove the auth.users entry; the schema's
    FK ON DELETE CASCADE removes the profile and all owned rows. Audited.
    """
    if not supabase_enabled():
        raise HTTPException(status_code=503, detail="Account deletion requires Supabase")
    if not ctx.user_id:
        raise HTTPException(status_code=403, detail="Create a free account to continue")

    sb = _supabase_client()
    if not sb:
        raise HTTPException(status_code=503, detail="Account deletion requires Supabase")

    audit.log(
        actor_user_id=ctx.user_id,
        action="account.delete",
        target_type="user",
        target_id=ctx.user_id,
    )
    try:
        sb.auth.admin.delete_user(ctx.user_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Could not delete account")

    return {"ok": True}
