"""Extension sync — lets Pro users pull their cloud resumes into the Chrome
extension via a one-time short-lived token.

POST /api/ext/sync-token  (authenticated, Pro-only) → { token, expiresAt }
POST /api/ext/resumes     (token-authenticated)      → { resumes: [...] }
"""
import base64
import hashlib
import hmac
import json
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import config
from app.deps import AuthContext, require_pro
from app.services.entitlements import get_plan, is_pro

router = APIRouter(prefix="/api/ext", tags=["ext"])

_EXT_SYNC_TTL = 5 * 60  # 5 minutes in seconds


# ── Token helpers ──────────────────────────────────────────────────────────────

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    pad = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * pad)


def _sign(payload: bytes) -> bytes:
    return hmac.new(
        config.EXT_SYNC_SECRET.encode(), payload, hashlib.sha256
    ).hexdigest().encode()


def mint_sync_token(user_id: str) -> str:
    payload_dict = {
        "user_id": user_id,
        "purpose": "ext-sync",
        "exp": int(time.time()) + _EXT_SYNC_TTL,
    }
    payload_b64 = _b64url_encode(json.dumps(payload_dict).encode())
    sig = _sign(payload_b64.encode())
    return f"{payload_b64}.{sig.decode()}"


def verify_sync_token(token: str) -> dict[str, Any]:
    """Return decoded payload or raise 401."""
    try:
        parts = token.split(".")
        if len(parts) != 2:
            raise ValueError("bad format")
        payload_b64, sig_hex = parts
        expected = _sign(payload_b64.encode()).decode()
        if not hmac.compare_digest(sig_hex, expected):
            raise ValueError("bad signature")
        payload = json.loads(_b64url_decode(payload_b64))
        if payload.get("purpose") != "ext-sync":
            raise ValueError("wrong purpose")
        if payload.get("exp", 0) < time.time():
            raise ValueError("token expired")
        return payload
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid or expired sync token: {exc}")


# ── Schemas ───────────────────────────────────────────────────────────────────

class ResumesRequest(BaseModel):
    token: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/sync-token")
async def create_sync_token(ctx: AuthContext = Depends(require_pro)):  # type: ignore[override]
    """Mint a short-lived token the Chrome extension can use to import resumes."""
    if not ctx.user_id:
        raise HTTPException(status_code=403, detail="An account is required")
    token = mint_sync_token(ctx.user_id)
    return {"token": token, "expiresAt": str(int(time.time()) + _EXT_SYNC_TTL)}


@router.post("/resumes")
async def import_resumes(body: ResumesRequest):
    """Exchange a sync token for the user's saved resumes (Pro-only, rechecked)."""
    payload = verify_sync_token(body.token)
    user_id: str = payload["user_id"]

    # Re-check Pro at call time
    plan = get_plan(user_id, user_id)
    if not is_pro(plan, user_id):
        raise HTTPException(status_code=403, detail="Pro plan required")

    from app.services.supabase_client import get_client

    sb = get_client()
    if not sb:
        raise HTTPException(status_code=503, detail="Cloud not available")

    try:
        res = (
            sb.table("resumes")
            .select("content,updated_at")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to load resumes")

    resumes: list[dict[str, Any]] = []
    seen_names: dict[str, int] = {}
    for row in (res.data or []):
        content = row.get("content")
        if not content or not isinstance(content, dict):
            continue
        tag = (content.get("contact", {}) or {}).get("fullName") or "Resume"
        # Deduplicate tags
        count = seen_names.get(tag, 0)
        if count > 0:
            tag = f"{tag} #{count + 1}"
        seen_names[tag] = count + 1
        resumes.append({"tag": tag, "resume": content})

    return {"resumes": resumes}
