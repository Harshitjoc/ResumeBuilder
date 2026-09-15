"""Tests for entitlements, payments, shares, ats-file, and jobs.

Runs WITHOUT Ollama and WITHOUT Supabase — all features use JSON file fallback.
Existing tests in test_llm_routes.py and test_new_routes.py stay green because
they never send X-Client-Key (quota dependency is skipped).
"""
import json
import os
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ["ENABLE_ENTITLEMENTS"] = "true"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services import entitlements  # noqa: E402

_DATA_DIR = Path(__file__).resolve().parents[1] / "data"
for f in ("payments.json", "entitlements.json", "usage.json", "shares.json"):
    p = _DATA_DIR / f
    if p.exists():
        p.unlink()

client = TestClient(app)

SAMPLE_RESUME = {
    "fullName": "Test User",
    "contact": {"email": "test@example.com", "phone": "+1 555 0100"},
    "skills": ["Python", "FastAPI"],
    "workExperience": [
        {
            "company": "Acme",
            "title": "Dev",
            "startDate": "2020-01",
            "endDate": "2022-06",
            "bullets": ["Built things."],
        }
    ],
    "education": [{"school": "MIT", "degree": "BS", "startDate": "2016", "endDate": "2020"}],
    "projects": [],
    "certifications": [],
}


# ── GET /api/me ──────────────────────────────────────────────────────────
def test_me_returns_free_plan():
    resp = client.get("/api/me", headers={"X-Client-Key": "test-me-1"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["plan"] == "free"
    assert body["quotaUnlimited"] is False
    assert body["quotaLimit"] == 25
    assert isinstance(body["quotaRemaining"], int)
    assert body["clientKey"] == "test-me-1"


# ── GET /api/payments/meta ──────────────────────────────────────────────
def test_payments_meta():
    resp = client.get("/api/payments/meta")
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "manual"
    assert isinstance(body["amount"], int)
    assert body["currency"] == "INR"


# ── POST /api/payments/request ──────────────────────────────────────────
def test_payment_request_blank_utr():
    resp = client.post(
        "/api/payments/request",
        json={"utr": "  ", "email": "a@b.com"},
        headers={"X-Client-Key": "t-req"},
    )
    assert resp.status_code == 400, resp.text


def test_payment_request_ok():
    resp = client.post(
        "/api/payments/request",
        json={"utr": "UTR123456789", "name": "Test", "email": "a@b.com"},
        headers={"X-Client-Key": "t-req"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is True
    assert body["status"] == "pending"


def test_payment_request_duplicate_utr():
    resp = client.post(
        "/api/payments/request",
        json={"utr": "UTR123456789"},
        headers={"X-Client-Key": "t-req"},
    )
    assert resp.status_code == 409, resp.text


def test_me_still_free_after_request():
    resp = client.get("/api/me", headers={"X-Client-Key": "t-req"})
    assert resp.status_code == 200
    assert resp.json()["plan"] == "free"


# ── Admin endpoints ─────────────────────────────────────────────────────
def test_admin_requests_no_token():
    resp = client.get("/api/payments/requests")
    assert resp.status_code == 401


def test_admin_requests_with_token():
    resp = client.get(
        "/api/payments/requests",
        headers={"Authorization": "Bearer admin-dev"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "requests" in body


def test_approve_no_token():
    resp = client.post("/api/payments/requests/fake-id/approve")
    assert resp.status_code == 401


def test_approve_missing_id():
    resp = client.post(
        "/api/payments/requests/00000000-0000-0000-0000-000000000000/approve",
        headers={"Authorization": "Bearer admin-dev"},
    )
    assert resp.status_code == 404, resp.text


def test_approve_then_me_pro():
    create_resp = client.post(
        "/api/payments/request",
        json={"utr": "UTR_PRO_999"},
        headers={"X-Client-Key": "t-pro"},
    )
    assert create_resp.status_code == 200, create_resp.text
    req_id = create_resp.json()["requestId"]

    approve_resp = client.post(
        f"/api/payments/requests/{req_id}/approve",
        headers={"Authorization": "Bearer admin-dev"},
    )
    assert approve_resp.status_code == 200, approve_resp.text
    body = approve_resp.json()
    assert body["plan"] == "pro"

    me_resp = client.get("/api/me", headers={"X-Client-Key": "t-pro"})
    assert me_resp.status_code == 200
    assert me_resp.json()["plan"] == "pro"
    assert me_resp.json()["quotaUnlimited"] is True


def test_approve_wrong_token():
    create_resp = client.post(
        "/api/payments/request",
        json={"utr": "UTR_WRONG_TOKEN"},
        headers={"X-Client-Key": "t-wrong"},
    )
    req_id = create_resp.json()["requestId"]
    resp = client.post(
        f"/api/payments/requests/{req_id}/approve",
        headers={"Authorization": "Bearer wrong-token"},
    )
    assert resp.status_code == 401


def test_reject_then_still_free():
    create_resp = client.post(
        "/api/payments/request",
        json={"utr": "UTR_REJECT_001"},
        headers={"X-Client-Key": "t-rej"},
    )
    req_id = create_resp.json()["requestId"]
    reject_resp = client.post(
        f"/api/payments/requests/{req_id}/reject",
        headers={"Authorization": "Bearer admin-dev"},
    )
    assert reject_resp.status_code == 200
    assert reject_resp.json()["status"] == "rejected"

    me_resp = client.get("/api/me", headers={"X-Client-Key": "t-rej"})
    assert me_resp.json()["plan"] == "free"


# ── Shares ──────────────────────────────────────────────────────────────
def test_share_free_user_forbidden():
    resp = client.post(
        "/api/shares/",
        json={"name": "My Resume", "resume": SAMPLE_RESUME},
        headers={"X-Client-Key": "t-free-share"},
    )
    assert resp.status_code == 403, resp.text


def test_share_pro_user_ok():
    create_resp = client.post(
        "/api/payments/request",
        json={"utr": "UTR_SHARE_001"},
        headers={"X-Client-Key": "t-pro-share"},
    )
    req_id = create_resp.json()["requestId"]
    client.post(
        f"/api/payments/requests/{req_id}/approve",
        headers={"Authorization": "Bearer admin-dev"},
    )

    resp = client.post(
        "/api/shares/",
        json={"name": "My Resume", "atsScore": 84, "resume": SAMPLE_RESUME},
        headers={"X-Client-Key": "t-pro-share"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "My Resume"
    assert body["atsScore"] == 84
    slug = body["slug"]
    assert len(slug) > 5

    get_resp = client.get(f"/api/shares/{slug}")
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "My Resume"

    badge_resp = client.get(f"/api/shares/{slug}/badge.svg")
    assert badge_resp.status_code == 200
    assert "image/svg+xml" in badge_resp.headers["content-type"]
    assert "ATS 84" in badge_resp.text


def test_share_not_found():
    resp = client.get("/api/shares/nonexistent")
    assert resp.status_code == 404


def test_share_badge_no_score():
    create_resp = client.post(
        "/api/payments/request",
        json={"utr": "UTR_BADGE_001"},
        headers={"X-Client-Key": "t-pro-badge"},
    )
    req_id = create_resp.json()["requestId"]
    client.post(
        f"/api/payments/requests/{req_id}/approve",
        headers={"Authorization": "Bearer admin-dev"},
    )
    share_resp = client.post(
        "/api/shares/",
        json={"name": "No Score", "resume": SAMPLE_RESUME},
        headers={"X-Client-Key": "t-pro-badge"},
    )
    slug = share_resp.json()["slug"]
    badge_resp = client.get(f"/api/shares/{slug}/badge.svg")
    assert badge_resp.status_code == 200
    assert "ATS --" in badge_resp.text


def test_share_ref_persisted():
    create_resp = client.post(
        "/api/payments/request",
        json={"utr": "UTR_REF_001"},
        headers={"X-Client-Key": "t-pro-ref"},
    )
    req_id = create_resp.json()["requestId"]
    client.post(
        f"/api/payments/requests/{req_id}/approve",
        headers={"Authorization": "Bearer admin-dev"},
    )
    share_resp = client.post(
        "/api/shares/",
        json={
            "name": "Referred Resume",
            "atsScore": 91,
            "resume": SAMPLE_RESUME,
            "ref": "clientkey-abc-123",
        },
        headers={"X-Client-Key": "t-pro-ref"},
    )
    assert share_resp.status_code == 200, share_resp.text
    assert share_resp.json()["ref"] == "clientkey-abc-123"

    get_resp = client.get(f"/api/shares/{share_resp.json()['slug']}")
    assert get_resp.status_code == 200
    assert get_resp.json()["ref"] == "clientkey-abc-123"


def test_share_ref_absent_defaults_none():
    create_resp = client.post(
        "/api/payments/request",
        json={"utr": "UTR_REF_NONE_001"},
        headers={"X-Client-Key": "t-pro-refnone"},
    )
    req_id = create_resp.json()["requestId"]
    client.post(
        f"/api/payments/requests/{req_id}/approve",
        headers={"Authorization": "Bearer admin-dev"},
    )
    share_resp = client.post(
        "/api/shares/",
        json={"name": "Plain Resume", "resume": SAMPLE_RESUME},
        headers={"X-Client-Key": "t-pro-refnone"},
    )
    assert share_resp.status_code == 200
    assert share_resp.json().get("ref") is None


# ── Quota ───────────────────────────────────────────────────────────────
def test_quota_check_and_increment_unit():
    old = entitlements.config.FREE_DAILY_LLM
    entitlements.config.FREE_DAILY_LLM = 2
    try:
        key = "quota-unit-test"
        today = date.today().isoformat()
        r1 = entitlements.check_and_increment(key, day=today)
        assert r1["allowed"] is True
        assert r1["remaining"] == 1
        r2 = entitlements.check_and_increment(key, day=today)
        assert r2["allowed"] is True
        assert r2["remaining"] == 0
        r3 = entitlements.check_and_increment(key, day=today)
        assert r3["allowed"] is False
        assert r3["remaining"] == 0
    finally:
        entitlements.config.FREE_DAILY_LLM = old


def test_quota_429_endpoint(monkeypatch):
    monkeypatch.setattr(entitlements.config, "FREE_DAILY_LLM", 1)
    key = "quota-ep-test"
    today = date.today().isoformat()
    entitlements.check_and_increment(key, day=today)

    resp = client.post(
        "/api/llm/generate-summary",
        json={"resume": SAMPLE_RESUME, "apiKeys": {"provider": "bogus"}},
        headers={"X-Client-Key": key},
    )
    assert resp.status_code == 429, resp.text
    body = resp.json()
    assert "limit" in body["detail"]


def test_no_header_skips_quota():
    resp = client.post(
        "/api/llm/generate-summary",
        json={"resume": SAMPLE_RESUME, "apiKeys": {"provider": "bogus"}},
    )
    assert resp.status_code == 400


# ── Disable entitlements ────────────────────────────────────────────────
def test_entitlements_disabled_allows_everything(monkeypatch):
    monkeypatch.setattr(entitlements.config, "ENABLE_ENTITLEMENTS", "false")
    old_limit = entitlements.config.FREE_DAILY_LLM
    entitlements.config.FREE_DAILY_LLM = 1
    try:
        r = entitlements.check_and_increment("anything", day="2099-01-03")
        assert r["allowed"] is True
        assert r["remaining"] is None
    finally:
        entitlements.config.FREE_DAILY_LLM = old_limit
        monkeypatch.setattr(entitlements.config, "ENABLE_ENTITLEMENTS", "true")
