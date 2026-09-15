"""Extension sync routes — token minting + resume import.

Runs in the file-store mode (Supabase env is reset to None by conftest), so
plans live in backend/data/entitlements.json and the resumes client is mocked.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.routers.ext import mint_sync_token  # noqa: E402
from app.services.entitlements import set_plan  # noqa: E402

client = TestClient(app)

PRO_USER = "test-ext-pro-user"
FREE_USER = "test-ext-free-user"


def _headers_for(user_id: str) -> dict:
    return {"X-User-Id": user_id, "X-Client-Key": user_id}


def test_sync_token_requires_pro():
    set_plan(FREE_USER, FREE_USER, "free")
    resp = client.post("/api/ext/sync-token", headers=_headers_for(FREE_USER))
    assert resp.status_code == 403, resp.text


def test_sync_token_mints_for_pro():
    set_plan(PRO_USER, PRO_USER, "pro", 12)
    resp = client.post("/api/ext/sync-token", headers=_headers_for(PRO_USER))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["token"]
    assert int(body["expiresAt"]) > time.time()
    # Token must round-trip through verification
    from app.routers.ext import verify_sync_token

    payload = verify_sync_token(body["token"])
    assert payload["user_id"] == PRO_USER
    assert payload["purpose"] == "ext-sync"


def test_resumes_rejects_invalid_token():
    resp = client.post("/api/ext/resumes", json={"token": "not-a-real-token"})
    assert resp.status_code == 401


def test_resumes_rejects_expired_token():
    set_plan(PRO_USER, PRO_USER, "pro", 12)
    expired = "eyJ1c2VyX2lkIjoidGVzdCIsImV4cCI6MSwicHVycG9zZSI6ImV4dC1zeW5jIn0."
    sig = __import__("hmac").new(b"dev-ext-sync-secret", expired.encode(), __import__("hashlib").sha256).hexdigest()
    resp = client.post("/api/ext/resumes", json={"token": f"{expired}.{sig}"})
    assert resp.status_code == 401


def test_resumes_requires_pro_at_use_time(monkeypatch):
    # User was Pro when the token was minted, but is free now
    set_plan(FREE_USER, FREE_USER, "free")
    token = mint_sync_token(FREE_USER)
    resp = client.post("/api/ext/resumes", json={"token": token})
    assert resp.status_code == 403, resp.text


class _FakeBuilder:
    """Minimal Supabase-query-chain double returning canned rows."""

    def __init__(self, rows):
        self._rows = rows

    def select(self, *cols, **kw):
        return self

    def eq(self, col, val):
        return self

    def order(self, col, **kw):
        return self

    def execute(self):
        from types import SimpleNamespace

        return SimpleNamespace(data=self._rows)


def test_resumes_happy_path(monkeypatch):
    set_plan(PRO_USER, PRO_USER, "pro", 12)
    rows = [
        {
            "content": {
                "contact": {"fullName": "Ada Lovelace", "email": "ada@example.com"},
                "skills": ["Python"],
            },
            "updated_at": "2026-01-02T00:00:00Z",
        },
        {
            "content": {
                "contact": {"fullName": "Ada Lovelace", "email": "ada@yahoo.com"},
                "skills": ["SQL"],
            },
            "updated_at": "2026-01-01T00:00:00Z",
        },
    ]
    import app.services.supabase_client as sb_module
    from types import SimpleNamespace

    def fake_get_client():
        state = {"count": 0}

        class _Client:
            def table(self, name):
                assert name == "resumes"
                return _FakeBuilder(rows)

        return _Client()

    monkeypatch.setattr(sb_module, "get_client", fake_get_client)

    token = mint_sync_token(PRO_USER)
    resp = client.post("/api/ext/resumes", json={"token": token})
    assert resp.status_code == 200, resp.text
    resumes = resp.json()["resumes"]
    assert len(resumes) == 2
    assert resumes[0]["tag"] == "Ada Lovelace"
    assert resumes[1]["tag"] == "Ada Lovelace #2"


def test_resumes_empty_list(monkeypatch):
    set_plan(PRO_USER, PRO_USER, "pro", 12)
    import app.services.supabase_client as sb_module

    class _Client:
        def table(self, name):
            return _FakeBuilder([])

    monkeypatch.setattr(sb_module, "get_client", _Client)

    token = mint_sync_token(PRO_USER)
    resp = client.post("/api/ext/resumes", json={"token": token})
    assert resp.status_code == 200, resp.text
    assert resp.json()["resumes"] == []