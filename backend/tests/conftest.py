"""Test-suite isolation.

`backend/.env` may carry real Supabase credentials for local dev. That must
never leak into the test process, so every test starts with the Supabase
config reset to the anonymous/local legacy mode. Tests that need verified mode
set their own config via a module-level autouse fixture (which runs after this,
overriding our resets).
"""
import pytest

from app import config


@pytest.fixture(autouse=True)
def _isolate_supabase_env(monkeypatch):
    monkeypatch.setattr(config, "SUPABASE_URL", None)
    monkeypatch.setattr(config, "SUPABASE_SERVICE_KEY", None)
    monkeypatch.setattr(config, "SUPABASE_JWT_SECRET", None)
    monkeypatch.setattr(config, "SUPABASE_JWKS_URL", None)
    monkeypatch.setattr(config, "ADMIN_TOKEN", "admin-dev")
    # Ensure a stash of a previous JWT client isn't reused across tests.
    import app.deps as deps

    monkeypatch.setattr(deps, "_jwk_client", None)


@pytest.fixture
def supabase_legacy_mode(monkeypatch):
    """Explicit legacy-verified mode using an HS256 shared secret."""
    monkeypatch.setattr(config, "SUPABASE_URL", "https://legacy.test.supabase.co")
    monkeypatch.setattr(config, "SUPABASE_JWT_SECRET", "legacy-secret-0123456789abcdef")
    monkeypatch.setattr(config, "SUPABASE_JWKS_URL", None)
    monkeypatch.setattr(config, "SUPABASE_SERVICE_KEY", "service-key")