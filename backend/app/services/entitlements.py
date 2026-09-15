"""Entitlements + quota store backed by JSON files (Supabase optional)."""
import json
import threading
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app import config

_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_ENT_FILE = _DATA_DIR / "entitlements.json"
_USAGE_FILE = _DATA_DIR / "usage.json"

_lock = threading.Lock()


def _ensure_data_dir() -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def _write_json(path: Path, data: Any) -> None:
    _ensure_data_dir()
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def _supabase_client():
    from app.services.supabase_client import get_client
    return get_client()


def get_plan(identity_key: str, user_id: str | None = None) -> str:
    sb = _supabase_client()
    if sb and user_id:
        try:
            res = sb.table("profiles").select("plan,plan_expires_at").eq("id", user_id).limit(1).execute()
            if res.data:
                row = res.data[0]
                plan = row.get("plan", "free")
                exp = row.get("plan_expires_at")
                if plan == "pro" and exp:
                    exp_dt = datetime.fromisoformat(str(exp).replace("Z", "+00:00"))
                    if exp_dt < datetime.now(timezone.utc):
                        return "free"
                return plan or "free"
        except Exception:
            pass

    with _lock:
        data = _read_json(_ENT_FILE) or {}
        entry = data.get(identity_key, {})
        plan = entry.get("plan", "free")
        exp = entry.get("expires_at")
        if plan == "pro" and exp:
            try:
                exp_dt = datetime.fromisoformat(str(exp).replace("Z", "+00:00"))
                if exp_dt < datetime.now(timezone.utc):
                    return "free"
            except Exception:
                pass
        return plan or "free"


def is_admin_user(user_id: str | None) -> bool:
    """True when the signed-in user holds the admin role in Supabase profiles.

    File-store mode has no roles, so this returns False there.
    """
    if not user_id:
        return False
    sb = _supabase_client()
    if not sb:
        return False
    try:
        res = sb.table("profiles").select("role").eq("id", user_id).limit(1).execute()
        return bool(res.data) and res.data[0].get("role") == "admin"
    except Exception:
        return False


def get_feature_flags() -> dict[str, Any]:
    """Reads the admin-controlled `features` settings block (global kill switches).

    Keys absent from the settings row fall back to enabled (True).
    """
    sb = _supabase_client()
    if sb:
        try:
            res = sb.table("system_settings").select("value").eq("key", "features").limit(1).execute()
            if res.data:
                value = res.data[0].get("value") or {}
                if isinstance(value, dict):
                    return dict(value)
        except Exception:
            pass
    return {}


def feature_enabled(feature: str, default: bool = True) -> bool:
    """Global feature toggle. When explicitly False the feature is disabled for
    everyone (maintenance / abuse-control switch), regardless of plan.
    """
    value = get_feature_flags().get(feature, default)
    return bool(value)


def is_pro(plan: str, user_id: str | None, identity_key: str | None = None, now: datetime | None = None) -> bool:
    if is_admin_user(user_id):
        return True
    if plan != "pro":
        return False
    now = now or datetime.now(timezone.utc)
    if user_id:
        sb = _supabase_client()
        if sb:
            try:
                res = sb.table("profiles").select("plan_expires_at").eq("id", user_id).limit(1).execute()
                if res.data:
                    exp = res.data[0].get("plan_expires_at")
                    if exp:
                        exp_dt = datetime.fromisoformat(str(exp).replace("Z", "+00:00"))
                        return exp_dt > now
                    return True
            except Exception:
                pass

    lookup_key = identity_key or user_id or ""
    with _lock:
        data = _read_json(_ENT_FILE) or {}
        entry = data.get(lookup_key, {})
        if entry.get("plan") != "pro":
            return False
        exp = entry.get("expires_at")
        if exp:
            exp_dt = datetime.fromisoformat(str(exp).replace("Z", "+00:00"))
            return exp_dt > now
        return True


def _free_quota_limit() -> int:
    sb = _supabase_client()
    if sb:
        try:
            res = sb.table("system_settings").select("value").eq("key", "quotas").limit(1).execute()
            if res.data:
                setting = res.data[0].get("value") or {}
                limit = setting.get("free_daily_llm")
                if isinstance(limit, int) and limit > 0:
                    return limit
        except Exception:
            pass
    return config.FREE_DAILY_LLM


def check_and_increment(
    identity_key: str,
    user_id: str | None = None,
    day: str | None = None,
) -> dict[str, Any]:
    if config.ENABLE_ENTITLEMENTS == "false":
        return {"allowed": True, "remaining": None, "limit": None}
    if not identity_key:
        return {"allowed": True, "remaining": None, "limit": None}
    if is_admin_user(user_id):
        return {"allowed": True, "remaining": None, "limit": None}

    plan = get_plan(user_id or identity_key, user_id)
    if plan == "pro":
        return {"allowed": True, "remaining": None, "limit": None}

    day = day or date.today().isoformat()

    sb = _supabase_client()
    if sb and user_id:
        try:
            limit = _free_quota_limit()
            res = sb.table("usage_logs").select("calls").eq("identity_key", identity_key).eq("day", day).limit(1).execute()
            current = res.data[0]["calls"] if res.data else 0
            if current >= limit:
                return {"allowed": False, "remaining": 0, "limit": limit}
            next_calls = current + 1
            sb.table("usage_logs").upsert(
                {"identity_key": identity_key, "day": day, "calls": next_calls},
                on_conflict="identity_key,day",
            ).execute()
            return {"allowed": True, "remaining": limit - next_calls, "limit": limit}
        except Exception:
            pass

    limit = config.FREE_DAILY_LLM
    with _lock:
        data = _read_json(_USAGE_FILE) or {}
        key_data = data.get(identity_key, {})
        current = key_data.get(day, 0)
        if current >= limit:
            return {"allowed": False, "remaining": 0, "limit": limit}
        key_data[day] = current + 1
        data[identity_key] = key_data
        _write_json(_USAGE_FILE, data)

    return {"allowed": True, "remaining": limit - (current + 1), "limit": limit}


def set_plan(
    identity_key: str,
    user_id: str | None = None,
    plan: str = "pro",
    months: int = 12,
) -> str:
    expires_at = (datetime.now(timezone.utc) + timedelta(days=months * 30)).isoformat()

    with _lock:
        data = _read_json(_ENT_FILE) or {}
        data[identity_key] = {"plan": plan, "expires_at": expires_at}
        _write_json(_ENT_FILE, data)

    sb = _supabase_client()
    if sb and user_id:
        try:
            sb.table("profiles").update(
                {"plan": plan, "plan_expires_at": expires_at}
            ).eq("id", user_id).execute()
        except Exception:
            pass

    return expires_at


def get_cached(user_id: str | None, identity_key: str | None = None) -> dict[str, Any]:
    if is_admin_user(user_id):
        return {
            "plan": "pro",
            "planExpiresAt": None,
            "quotaRemaining": None,
            "quotaLimit": None,
            "quotaUnlimited": True,
        }
    key = user_id or identity_key or ""
    plan = get_plan(key, user_id)
    is_p = is_pro(plan, user_id, identity_key=identity_key)
    if is_p:
        return {
            "plan": plan,
            "planExpiresAt": None,
            "quotaRemaining": None,
            "quotaLimit": None,
            "quotaUnlimited": True,
        }
    today = date.today().isoformat()

    sb = _supabase_client()
    if sb and user_id:
        try:
            limit = _free_quota_limit()
            res = sb.table("usage_logs").select("calls").eq("identity_key", user_id).eq("day", today).limit(1).execute()
            used = res.data[0]["calls"] if res.data else 0
            return {
                "plan": plan,
                "planExpiresAt": None,
                "quotaRemaining": max(0, limit - used),
                "quotaLimit": limit,
                "quotaUnlimited": False,
            }
        except Exception:
            pass

    with _lock:
        usage_data = _read_json(_USAGE_FILE) or {}
        key_data = usage_data.get(key, {})
        used = key_data.get(today, 0)
    limit = config.FREE_DAILY_LLM
    return {
        "plan": plan,
        "planExpiresAt": None,
        "quotaRemaining": max(0, limit - used),
        "quotaLimit": limit,
        "quotaUnlimited": False,
    }
