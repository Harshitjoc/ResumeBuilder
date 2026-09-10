"""Tests for Supabase-mode JWT verification and the identity dependency chain.

Pure unit/integration tests: no Ollama, no live Supabase. Supabase mode is
enabled by monkeypatching the config module; DB calls fall back to the JSON
file store and admin role checks are stubbed. The legacy X-Client-Key /
X-User-Id fallback path is preserved by the existing entitlement tests.
"""
import asyncio
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import jwt as pyjwt  # noqa: E402
import pytest  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import config  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)

TEST_SECRET = "test-supabase-jwt-secret-0123456789abcdef"
TEST_URL = "https://test.supabase.co"


def _token(
    secret: str = TEST_SECRET,
    sub: str | None = None,
    is_anonymous: bool = False,
    exp_offset: int = 3600,
) -> str:
    now = int(time.time())
    payload = {
        "sub": sub or str(uuid.uuid4()),
        "is_anonymous": is_anonymous,
        "role": "authenticated",
        "aud": "authenticated",
        "iat": now,
        "exp": now + exp_offset,
    }
    return pyjwt.encode(payload, secret, algorithm="HS256")


def _run(coro):
    return asyncio.run(coro)


class _FakeRequest:
    headers: dict = {}


@pytest.fixture(autouse=True)
def _supabase_mode(monkeypatch):
    monkeypatch.setattr(config, "SUPABASE_URL", TEST_URL)
    monkeypatch.setattr(config, "SUPABASE_JWT_SECRET", TEST_SECRET)
    monkeypatch.setattr(config, "SUPABASE_SERVICE_KEY", "service-role-key")
    yield


# ── /api/me JWT flow ──────────────────────────────────────────────────────
def test_me_no_token_is_anonymous_local():
    resp = client.get("/api/me")
    assert resp.status_code == 200
    assert resp.json()["is_anonymous"] is False
    assert resp.json()["plan"] == "free"


def test_me_rejects_bad_signature():
    bad = pyjwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
        },
        "a-different-secret-key-that-is-also-long",
        algorithm="HS256",
    )
    resp = client.get("/api/me", headers={"Authorization": f"Bearer {bad}"})
    assert resp.status_code == 401


def test_me_rejects_expired_token():
    resp = client.get("/api/me", headers={"Authorization": f"Bearer {_token(exp_offset=-60)}"})
    assert resp.status_code == 401


def test_me_accepts_valid_token():
    resp = client.get("/api/me", headers={"Authorization": f"Bearer {_token()}"})
    assert resp.status_code == 200
    assert resp.json()["is_anonymous"] is False


def test_me_anonymous_claim():
    resp = client.get("/api/me", headers={"Authorization": f"Bearer {_token(is_anonymous=True)}"})
    assert resp.status_code == 200
    assert resp.json()["is_anonymous"] is True


def test_token_has_expected_claims():
    payload = pyjwt.decode(
        _token(),
        TEST_SECRET,
        algorithms=["HS256"],
        audience="authenticated",
    )
    assert payload["aud"] == "authenticated"
    assert "sub" in payload
    assert payload["is_anonymous"] is False
    assert payload["exp"] > int(time.time())


# ── dependency chain ──────────────────────────────────────────────────────
def test_require_user_rejects_anonymous():
    from app.deps import AuthContext, require_user

    with pytest.raises(HTTPException) as exc:
        _run(require_user(AuthContext(user_id=str(uuid.uuid4()), is_anonymous=True)))
    assert exc.value.status_code == 403


def test_require_user_accepts_permanent_user():
    from app.deps import AuthContext, require_user

    out = _run(require_user(AuthContext(user_id=str(uuid.uuid4()), is_anonymous=False)))
    assert out.user_id


def test_require_pro_rejects_free_user():
    from app.deps import AuthContext, require_pro

    with pytest.raises(HTTPException) as exc:
        _run(require_pro(AuthContext(user_id=str(uuid.uuid4()), is_anonymous=False)))
    assert exc.value.status_code == 403
    assert "Pro" in exc.value.detail


def test_require_pro_rejects_anonymous():
    from app.deps import AuthContext, require_pro

    with pytest.raises(HTTPException) as exc:
        _run(require_pro(AuthContext(user_id=str(uuid.uuid4()), is_anonymous=True)))
    assert exc.value.status_code == 403


def test_require_admin_rejects_non_admin(monkeypatch):
    from app.deps import AuthContext, require_admin

    monkeypatch.setattr("app.deps._profile_role", lambda uid: "user")
    with pytest.raises(HTTPException) as exc:
        _run(require_admin(_FakeRequest(), AuthContext(user_id=str(uuid.uuid4()))))
    assert exc.value.status_code == 403


def test_require_admin_accepts_admin(monkeypatch):
    from app.deps import AuthContext, require_admin

    monkeypatch.setattr("app.deps._profile_role", lambda uid: "admin")
    out = _run(require_admin(_FakeRequest(), AuthContext(user_id=str(uuid.uuid4()))))
    assert out.user_id


# ── claim-anonymous (guest conversion, existing-email path) ────────────────
def test_claim_anonymous_requires_auth():
    resp = client.post("/api/auth/claim-anonymous", json={"anon_token": "x"})
    assert resp.status_code == 401


def test_claim_anonymous_requires_non_anon():
    resp = client.post(
        "/api/auth/claim-anonymous",
        json={"anon_token": "x"},
        headers={"Authorization": f"Bearer {_token(is_anonymous=True)}"},
    )
    assert resp.status_code == 403


def test_claim_anonymous_rejects_invalid_token():
    resp = client.post(
        "/api/auth/claim-anonymous",
        json={"anon_token": "not-a-jwt"},
        headers={"Authorization": f"Bearer {_token()}"},
    )
    assert resp.status_code == 400
    assert "anonymous" in resp.json()["detail"].lower()


def test_claim_anonymous_rejects_non_anon_token():
    token = _token(is_anonymous=False)
    resp = client.post(
        "/api/auth/claim-anonymous",
        json={"anon_token": token},
        headers={"Authorization": f"Bearer {_token()}"},
    )
    assert resp.status_code == 400


def test_claim_anonymous_rejects_same_account():
    uid = str(uuid.uuid4())
    anon_token = _token(sub=uid, is_anonymous=True)
    resp = client.post(
        "/api/auth/claim-anonymous",
        json={"anon_token": anon_token},
        headers={"Authorization": f"Bearer {_token(sub=uid)}"},
    )
    assert resp.status_code == 400


def test_claim_anonymous_migrates_rows(monkeypatch):
    fake_result = {
        "migrated": {"resumes": 1, "job_postings": 0, "applications": 0, "analysis_reports": 0, "evidence": 0, "shares": 0},
        "errors": [],
    }
    monkeypatch.setattr(
        "app.routers.auth.claim_anonymous_rows",
        lambda from_uid, to_uid: fake_result,
    )
    anon_uid = str(uuid.uuid4())
    anon_token = _token(sub=anon_uid, is_anonymous=True)
    resp = client.post(
        "/api/auth/claim-anonymous",
        json={"anon_token": anon_token},
        headers={"Authorization": f"Bearer {_token()}"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert resp.json()["migrated"]["resumes"] == 1


def test_claim_anonymous_rows_stub_client(monkeypatch):
    from app.services.conversion import claim_anonymous_rows

    class _Res:
        data = ["row"]

    class _Q:
        def update(self, payload):
            return self

        def eq(self, k, v):
            return self

        def execute(self):
            return _Res()

    fake_sb = object.__new__(type("_SB", (), {}))
    fake_sb.table = lambda name: _Q()
    monkeypatch.setattr("app.services.conversion._supabase_client", lambda: fake_sb)

    out = claim_anonymous_rows("anon-uid", "real-uid")
    assert out["migrated"]["resumes"] == 1
    assert out["errors"] == []


def test_claim_anonymous_rows_requires_supabase(monkeypatch):
    from app.services.conversion import claim_anonymous_rows

    monkeypatch.setattr("app.services.conversion._supabase_client", lambda: None)
    with pytest.raises(RuntimeError):
        claim_anonymous_rows("anon-uid", "real-uid")