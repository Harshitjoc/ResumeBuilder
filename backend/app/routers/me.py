from fastapi import APIRouter, Depends, Header

from app.deps import AuthContext, get_user_http
from app.services.entitlements import get_cached

router = APIRouter(tags=["me"])


@router.get("/api/me")
async def get_me(
    auth: AuthContext = Depends(get_user_http),
    x_client_key: str | None = Header(None),
):
    cached = get_cached(auth.user_id, auth.identity_key or x_client_key)
    return {
        "plan": cached["plan"],
        "planExpiresAt": cached["planExpiresAt"],
        "quotaRemaining": cached["quotaRemaining"],
        "quotaLimit": cached["quotaLimit"],
        "quotaUnlimited": cached["quotaUnlimited"],
        "clientKey": auth.client_key or "",
        "user_id": auth.user_id or "",
        "is_anonymous": auth.is_anonymous,
    }
