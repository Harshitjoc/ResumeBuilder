import json
import secrets
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from app import config
from app.services.entitlements import get_plan, is_pro

router = APIRouter(prefix="/api/shares", tags=["shares"])

_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_SHARES_FILE = _DATA_DIR / "shares.json"

_lock = threading.Lock()


def _supabase_client():
    if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_KEY:
        return None
    try:
        from supabase import create_client
        return create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    except Exception:
        return None


def _read_shares() -> dict[str, Any]:
    try:
        return json.loads(_SHARES_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _write_shares(data: dict[str, Any]) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _SHARES_FILE.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


class ShareCreate(BaseModel):
    name: str
    atsScore: int | None = None
    resume: dict[str, Any]


@router.post("/")
async def create_share(
    body: ShareCreate,
    x_client_key: str | None = Header(None),
    x_user_id: str | None = Header(None),
):
    identity = x_client_key or ""
    plan = get_plan(identity, x_user_id)
    if not is_pro(plan, x_user_id, identity_key=identity):
        raise HTTPException(status_code=403, detail="This feature requires Pro. Upgrade from /upgrade")

    slug = secrets.token_urlsafe(8)
    now = datetime.now(timezone.utc).isoformat()

    sb = _supabase_client()
    if sb:
        try:
            sb.table("shares").insert({
                "user_id": x_user_id,
                "slug": slug,
                "name": body.name,
                "resume_snapshot": body.resume,
                "ats_score": body.atsScore,
            }).execute()
            return {"slug": slug, "name": body.name, "atsScore": body.atsScore, "createdAt": now}
        except Exception:
            pass

    with _lock:
        shares = _read_shares()
        shares[slug] = {
            "slug": slug,
            "name": body.name,
            "atsScore": body.atsScore,
            "resume": body.resume,
            "createdAt": now,
        }
        _write_shares(shares)

    return {"slug": slug, "name": body.name, "atsScore": body.atsScore, "createdAt": now}


@router.get("/{slug}")
async def get_share(slug: str):
    sb = _supabase_client()
    if sb:
        try:
            res = sb.table("shares").select("name,created_at,ats_score,resume_snapshot").eq("slug", slug).limit(1).execute()
            if res.data:
                r = res.data[0]
                return {
                    "name": r["name"],
                    "createdAt": r["created_at"],
                    "atsScore": r.get("ats_score"),
                    "resume": r.get("resume_snapshot"),
                }
        except Exception:
            pass

    shares = _read_shares()
    entry = shares.get(slug)
    if not entry:
        raise HTTPException(status_code=404, detail="Share not found")
    return {
        "name": entry["name"],
        "createdAt": entry["createdAt"],
        "atsScore": entry.get("atsScore"),
        "resume": entry.get("resume"),
    }


@router.get("/{slug}/badge.svg")
async def badge_svg(slug: str):
    score: int | None = None

    sb = _supabase_client()
    if sb:
        try:
            res = sb.table("shares").select("ats_score").eq("slug", slug).limit(1).execute()
            if res.data:
                score = res.data[0].get("ats_score")
        except Exception:
            pass
    else:
        shares = _read_shares()
        entry = shares.get(slug)
        if entry:
            score = entry.get("atsScore")

    label = f"ATS {score}" if score is not None else "ATS --"
    if score is not None:
        color = "#16a34a" if score >= 80 else "#d97706" if score >= 60 else "#dc2626"
    else:
        color = "#6b7280"

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="180" height="44" viewBox="0 0 180 44">
  <rect width="180" height="44" rx="8" fill="{color}"/>
  <text x="90" y="27" font-family="Arial,sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle">{label}</text>
</svg>"""
    return HTMLResponse(content=svg, media_type="image/svg+xml", headers={"Cache-Control": "no-store"})
