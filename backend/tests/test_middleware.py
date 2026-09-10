"""Tests for the hardening middleware: headers, rate limiting, body caps."""
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import config  # noqa: E402
from app.main import app  # noqa: E402
from app.middleware import RateLimitStore, RATE_LIMITS  # noqa: E402

client = TestClient(app)

TEST_SECRET = "test-supabase-jwt-secret-0123456789abcdef"
TEST_URL = "https://test.supabase.co"


@pytest.fixture(autouse=True)
def _supabase_mode(monkeypatch):
    monkeypatch.setattr(config, "SUPABASE_URL", TEST_URL)
    monkeypatch.setattr(config, "SUPABASE_JWT_SECRET", TEST_SECRET)
    monkeypatch.setattr(config, "SUPABASE_SERVICE_KEY", "service-role-key")
    yield


def test_security_headers_present():
    resp = client.get("/api/me")
    assert resp.status_code == 200
    assert resp.headers.get("x-content-type-options") == "nosniff"
    assert resp.headers.get("x-frame-options") == "DENY"
    assert resp.headers.get("strict-transport-security", "").startswith("max-age=")
    assert resp.headers.get("referrer-policy") == "strict-origin-when-cross-origin"


def test_exempt_endpoints_are_not_rate_limited():
    for i in range(5):
        resp = client.get("/api/health")
        assert resp.status_code == 200


def test_oversize_body_rejected_before_auth():
    huge = "x" * (2 * 1024 * 1024 + 1)
    resp = client.post("/api/auth/claim-anonymous", content=huge, headers={"Content-Type": "application/json"})
    assert resp.status_code == 413


# ── RateLimitStore ─────────────────────────────────────────────────────────
def test_store_allows_default_limit_then_blocks():
    store = RateLimitStore()
    key = f"ip::{uuid.uuid4()}"
    limit, window = RATE_LIMITS["default"]
    for _ in range(limit):
        allowed, remaining, _ = store.allow(key, "/api/me")
        assert allowed
        assert remaining is not None and remaining >= 0
    allowed, _, retry = store.allow(key, "/api/me")
    assert allowed is False
    assert retry is not None and retry > 0


def test_store_matches_longest_prefix():
    store = RateLimitStore()
    key = f"ip::{uuid.uuid4()}"
    llm_limit = RATE_LIMITS["/api/llm"][0]
    for _ in range(llm_limit):
        assert store.allow(key, "/api/llm/generate-summary")[0]
    assert store.allow(key, "/api/llm/generate-summary")[0] is False
    # other scopes unaffected
    assert store.allow(key + "x", "/api/me")[0] is True


def test_store_window_expiry(monkeypatch):
    store = RateLimitStore()
    key = f"ip::{uuid.uuid4()}"
    now = [1_000_000.0]
    monkeypatch.setattr("app.middleware.time.time", lambda: now[0])
    limit, window = RATE_LIMITS["default"]
    for _ in range(limit):
        store.allow(key, "/api/me")
    assert store.allow(key, "/api/me")[0] is False
    now[0] += window + 1
    assert store.allow(key, "/api/me")[0] is True


def test_store_reset():
    store = RateLimitStore()
    key = f"ip::{uuid.uuid4()}"
    limit, _ = RATE_LIMITS["default"]
    for _ in range(limit):
        store.allow(key, "/api/me")
    store.reset()
    assert store.allow(key, "/api/me")[0] is True