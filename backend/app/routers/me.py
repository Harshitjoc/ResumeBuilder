from fastapi import APIRouter, Header

from app.services.entitlements import get_cached

router = APIRouter(tags=["me"])


@router.get("/api/me")
async def get_me(
    x_client_key: str | None = Header(None),
    x_user_id: str | None = Header(None),
):
    key = x_user_id or x_client_key or ""
    cached = get_cached(x_user_id, x_client_key)
    return {
        "plan": cached["plan"],
        "planExpiresAt": cached["planExpiresAt"],
        "quotaRemaining": cached["quotaRemaining"],
        "quotaLimit": cached["quotaLimit"],
        "quotaUnlimited": cached["quotaUnlimited"],
        "clientKey": x_client_key or "",
    }
