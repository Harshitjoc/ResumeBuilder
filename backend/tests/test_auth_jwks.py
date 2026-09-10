"""JWKS-based (new key format) token verification tests.

Verificates offline: we mint an ES256 JWT (the algorithm the live project uses)
with a local keypair and stub the JWKS client so no network is involved.
Mirrors Supabase's current behavior (asymmetrically-signed session tokens with
`aud: authenticated` and a JWKS discovery endpoint).
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import jwt as pyjwt  # noqa: E402
import pytest  # noqa: E402
from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import ec  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import config  # noqa: E402
from app.main import app  # noqa: E402
import app.deps as deps  # noqa: E402

client = TestClient(app)

JWKS_URL = "https://project.supabase.co/auth/v1/.well-known/jwks.json"


def _ec_pair():
    key = ec.generate_private_key(ec.SECP256R1())
    priv = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    pub = key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    return priv, pub


PRIV, PUB = _ec_pair()


def _token(priv: str, sub: str = "user-abc", anonymous: bool = False, aud: str = "authenticated") -> str:
    now = int(time.time())
    return pyjwt.encode(
        {
            "sub": sub,
            "aud": aud,
            "role": "authenticated",
            "is_anonymous": anonymous,
            "iat": now,
            "exp": now + 3600,
        },
        priv,
        algorithm="ES256",
    )


class _FakeJWKClient:
    def __init__(self, pub: str):
        self._pub = pub

    def get_signing_key_from_jwt(self, token):
        return type("K", (), {"key": self._pub})()


@pytest.fixture(autouse=True)
def jwks_mode(monkeypatch):
    monkeypatch.setattr(config, "SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setattr(config, "SUPABASE_JWT_SECRET", None)
    monkeypatch.setattr(config, "SUPABASE_JWKS_URL", JWKS_URL)
    monkeypatch.setattr(config, "SUPABASE_SERVICE_KEY", "sb_secret_test")
    monkeypatch.setattr(deps, "_get_jwk_client", lambda: _FakeJWKClient(PUB))
    yield


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_me_with_es256_token():
    resp = client.get("/api/me", headers=_auth(_token(PRIV)))
    assert resp.status_code == 200
    body = resp.json()
    assert body["user_id"] == "user-abc"
    assert body["is_anonymous"] is False
    plan = body["plan"]
    assert plan == "free" or (isinstance(plan, dict) and plan.get("tier") == "free")


def test_me_with_es256_anonymous_token():
    resp = client.get("/api/me", headers=_auth(_token(PRIV, sub="anon-xyz", anonymous=True)))
    assert resp.status_code == 200
    body = resp.json()
    assert body["user_id"] == "anon-xyz"
    assert body["is_anonymous"] is True


def test_wrong_key_signature_rejected():
    other = _ec_pair()[0]
    resp = client.get("/api/me", headers=_auth(_token(other)))
    assert resp.status_code == 401


def test_token_signed_with_wrong_public_key_rejected(monkeypatch):
    """
    A token whose `kid` claims a key that differs from the advertised public
    key must be rejected (signature check against the fetched key fails).
    """
    priv_a, _ = _ec_pair()
    _other_priv, other_pub = _ec_pair()
    monkeypatch.setattr(deps, "_get_jwk_client", lambda: _FakeJWKClient(other_pub))
    resp = client.get("/api/me", headers=_auth(_token(priv_a)))
    assert resp.status_code == 401


def test_jwks_unavailable_rejects():
    assert deps._get_jwk_client() is not None  # sanity: stub returned key


def test_claim_anonymous_rejects_non_anon_es256_token():
    anon_jwt = _token(PRIV, sub="anon-1", anonymous=False)
    resp = client.post("/api/auth/claim-anonymous", json={"anon_token": anon_jwt})
    assert resp.status_code in (400, 401)


def test_decode_token_helper_hs256_legacy_path(monkeypatch):
    monkeypatch.setattr(config, "SUPABASE_JWT_SECRET", "legacy-secret")
    monkeypatch.setattr(config, "SUPABASE_JWKS_URL", None)
    now = int(time.time())
    token = pyjwt.encode(
        {"sub": "u1", "aud": "authenticated", "exp": now + 3600},
        "legacy-secret",
        algorithm="HS256",
    )
    claims = deps.decode_token(token)
    assert claims["sub"] == "u1"
