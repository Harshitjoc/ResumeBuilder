import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from app import config
from app.deps import AuthContext, get_user_http

router = APIRouter(prefix="/api/payments", tags=["payments"])

_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_PAYMENTS_FILE = _DATA_DIR / "payments.json"

_lock = threading.Lock()


def _supabase_client():
    if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_KEY:
        return None
    try:
        from supabase import create_client
        return create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    except Exception:
        return None


def _read_payments() -> list[dict[str, Any]]:
    try:
        return json.loads(_PAYMENTS_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _write_payments(data: list[dict[str, Any]]) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _PAYMENTS_FILE.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def _check_admin(authorization: str | None) -> None:
    token = ""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    if token != config.ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Admin token required")


class PaymentRequest(BaseModel):
    utr: str
    email: str | None = None
    name: str | None = None


@router.get("/meta")
async def payment_meta():
    return {
        "upiId": config.UPI_ID,
        "payeeName": config.UPI_PAYEE_NAME,
        "amount": config.UPI_PAYMENT_AMOUNT,
        "currency": config.UPI_CURRENCY,
        "mode": "manual",
        "subscriptionMonths": config.SUBSCRIPTION_MONTHS,
    }


@router.post("/request")
async def create_request(
    body: PaymentRequest,
    auth: AuthContext = Depends(get_user_http),
):
    utr = (body.utr or "").strip()
    if not utr:
        raise HTTPException(status_code=400, detail="UTR is required")
    client_key = auth.client_key or ""
    user_id = auth.user_id

    sb = _supabase_client()
    if sb:
        try:
            existing = sb.table("plan_requests").select("id").eq("utr", utr).limit(1).execute()
            if existing.data:
                raise HTTPException(status_code=409, detail="UTR already submitted")
            res = sb.table("plan_requests").insert({
                "user_id": user_id,
                "client_key": client_key,
                "name": body.name,
                "email": body.email,
                "utr": utr,
                "amount": config.UPI_PAYMENT_AMOUNT,
                "status": "pending",
            }).execute()
            req_id = res.data[0]["id"]
            return {"ok": True, "requestId": req_id, "status": "pending"}
        except HTTPException:
            raise
        except Exception:
            pass

    with _lock:
        payments = _read_payments()
        for p in payments:
            if p.get("utr") == utr:
                raise HTTPException(status_code=409, detail="UTR already submitted")
        req_id = str(uuid.uuid4())
        entry = {
            "id": req_id,
            "clientKey": client_key,
            "userId": user_id,
            "name": body.name,
            "email": body.email,
            "utr": utr,
            "amount": config.UPI_PAYMENT_AMOUNT,
            "status": "pending",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        payments.append(entry)
        _write_payments(payments)

    return {"ok": True, "requestId": req_id, "status": "pending"}


@router.get("/requests")
async def list_requests(authorization: str | None = Header(None)):
    _check_admin(authorization)

    sb = _supabase_client()
    if sb:
        try:
            res = sb.table("plan_requests").select(
                "id,client_key,user_id,name,email,utr,amount,status,created_at"
            ).order("created_at", desc=True).execute()
            rows = []
            for r in res.data:
                rows.append({
                    "id": r["id"],
                    "clientKey": r.get("client_key", ""),
                    "userId": r.get("user_id"),
                    "name": r.get("name"),
                    "email": r.get("email"),
                    "utr": r.get("utr", ""),
                    "amount": r.get("amount"),
                    "status": r.get("status", "pending"),
                    "createdAt": r.get("created_at", ""),
                })
            return {"requests": rows}
        except Exception:
            pass

    payments = _read_payments()
    payments.sort(key=lambda p: p.get("createdAt", ""), reverse=True)
    return {"requests": payments}


@router.get("/requests/mine")
async def my_requests(
    auth: AuthContext = Depends(get_user_http),
):
    user_id = auth.user_id
    client_key = auth.client_key or ""
    key = user_id or client_key or ""
    if not key:
        return {"requests": []}

    sb = _supabase_client()
    if sb:
        try:
            res = sb.table("plan_requests").select(
                "id,client_key,user_id,name,email,utr,amount,status,created_at"
            ).order("created_at", desc=True).execute()
            rows = []
            for r in res.data:
                if r.get("user_id") == key or r.get("client_key") == key or (client_key and r.get("client_key") == client_key):
                    rows.append({
                        "id": r["id"],
                        "clientKey": r.get("client_key", ""),
                        "userId": r.get("user_id"),
                        "name": r.get("name"),
                        "email": r.get("email"),
                        "utr": r.get("utr", ""),
                        "amount": r.get("amount"),
                        "status": r.get("status", "pending"),
                        "createdAt": r.get("created_at", ""),
                    })
            return {"requests": rows}
        except Exception:
            pass

    with _lock:
        payments = _read_payments()
        mine = [
            p
            for p in payments
            if p.get("clientKey") == client_key or (key and bool(user_id) and p.get("userId") == key)
        ]
        mine.sort(key=lambda p: p.get("createdAt", ""), reverse=True)
    return {"requests": mine}


@router.post("/requests/{req_id}/approve")
async def approve_request(
    req_id: str,
    authorization: str | None = Header(None),
):
    _check_admin(authorization)

    sb = _supabase_client()
    if sb:
        try:
            res = sb.table("plan_requests").select("id,client_key,user_id,status").eq("id", req_id).limit(1).execute()
            if not res.data:
                raise HTTPException(status_code=404, detail="Request not found")
            row = res.data[0]
            if row["status"] != "pending":
                raise HTTPException(status_code=404, detail="Request already decided")

            from app.services.entitlements import set_plan
            expires = set_plan(row.get("client_key", ""), row.get("user_id"), "pro", config.SUBSCRIPTION_MONTHS)
            sb.table("plan_requests").update({
                "status": "approved",
                "decided_at": datetime.now(timezone.utc).isoformat(),
                "decided_by": config.ADMIN_TOKEN,
            }).eq("id", req_id).execute()
            from app.services import audit as audit_svc
            audit_svc.log(
                actor_label=f"admin:{config.ADMIN_TOKEN}",
                action="payment.approve",
                target_type="plan_request",
                target_id=req_id,
                before_data={"status": row["status"]},
                after_data={"status": "approved", "plan": "pro", "expires_at": expires},
            )
            return {"ok": True, "plan": "pro", "expiresAt": expires}
        except HTTPException:
            raise
        except Exception:
            pass

    with _lock:
        payments = _read_payments()
        target = None
        for p in payments:
            if p.get("id") == req_id:
                target = p
                break
        if not target:
            raise HTTPException(status_code=404, detail="Request not found")
        if target.get("status") != "pending":
            raise HTTPException(status_code=404, detail="Request already decided")

        from app.services.entitlements import set_plan
        expires = set_plan(target.get("clientKey", ""), target.get("userId"), "pro", config.SUBSCRIPTION_MONTHS)
        target["status"] = "approved"
        target["decidedAt"] = datetime.now(timezone.utc).isoformat()
        _write_payments(payments)

    return {"ok": True, "plan": "pro", "expiresAt": expires}


@router.post("/requests/{req_id}/reject")
async def reject_request(
    req_id: str,
    authorization: str | None = Header(None),
):
    _check_admin(authorization)

    sb = _supabase_client()
    if sb:
        try:
            res = sb.table("plan_requests").select("id,status").eq("id", req_id).limit(1).execute()
            if not res.data:
                raise HTTPException(status_code=404, detail="Request not found")
            row = res.data[0]
            if row["status"] != "pending":
                raise HTTPException(status_code=404, detail="Request already decided")
            sb.table("plan_requests").update({
                "status": "rejected",
                "decided_at": datetime.now(timezone.utc).isoformat(),
                "decided_by": config.ADMIN_TOKEN,
            }).eq("id", req_id).execute()
            from app.services import audit as audit_svc
            audit_svc.log(
                actor_label=f"admin:{config.ADMIN_TOKEN}",
                action="payment.reject",
                target_type="plan_request",
                target_id=req_id,
                before_data={"status": row["status"]},
                after_data={"status": "rejected"},
            )
            return {"ok": True, "status": "rejected"}
        except HTTPException:
            raise
        except Exception:
            pass

    with _lock:
        payments = _read_payments()
        target = None
        for p in payments:
            if p.get("id") == req_id:
                target = p
                break
        if not target:
            raise HTTPException(status_code=404, detail="Request not found")
        if target.get("status") != "pending":
            raise HTTPException(status_code=404, detail="Request already decided")
        target["status"] = "rejected"
        target["decidedAt"] = datetime.now(timezone.utc).isoformat()
        _write_payments(payments)

    return {"ok": True, "status": "rejected"}
