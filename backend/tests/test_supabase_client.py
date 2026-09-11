"""Unit tests for the Supabase client factory + PostgREST shim."""
import pytest

from app import config
from app.services.supabase_client import (
    SupabaseRestError,
    _RestClient,
    get_client,
)


class FakeResponse:
    def __init__(self, status_code=200, text="[]", headers=None, json_payload=None):
        self.status_code = status_code
        self.text = text
        self.headers = headers or {}
        if json_payload is not None:
            self._json = json_payload
        else:
            self._json = text if text != "[]" else []

    def json(self):
        return self._json


def _client_with(key="sb_secret_abc"):
    return _RestClient("https://x.supabase.co", key)


def test_get_client_returns_rest_shim_for_sb_keys(monkeypatch):
    monkeypatch.setattr(config, "SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setattr(config, "SUPABASE_SERVICE_KEY", "sb_secret_abc")
    assert isinstance(get_client(), _RestClient)


def test_get_client_none_when_not_configured(monkeypatch):
    monkeypatch.setattr(config, "SUPABASE_URL", None)
    monkeypatch.setattr(config, "SUPABASE_SERVICE_KEY", None)
    assert get_client() is None


def test_get_client_uses_legacy_create_client_for_jwt_keys(monkeypatch):
    sentinel = object()
    monkeypatch.setattr(config, "SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setattr(
        config, "SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.x"
    )
    monkeypatch.setattr(
        "supabase.create_client", lambda url, key: sentinel
    )
    assert get_client() is sentinel


def test_select_builds_query_and_returns_data(monkeypatch):
    calls = {}
    monkeypatch.setattr(
        "app.services.supabase_client.httpx.request",
        lambda method, path, *, headers, json, timeout: calls.update(
            method=method, path=path, headers=headers
        )
        or FakeResponse(json_payload=[{"id": "1"}]),
    )
    out = (
        _client_with()
        .table("profiles")
        .select("id,role")
        .eq("id", "abc-123")
        .limit(5)
        .execute()
    )
    assert out.data == [{"id": "1"}]
    assert calls["method"] == "GET"
    assert "/rest/v1/profiles?" in calls["path"]
    assert "id=eq.abc-123" in calls["path"]
    assert "limit=5" in calls["path"]


def test_select_count_parses_content_range(monkeypatch):
    monkeypatch.setattr(
        "app.services.supabase_client.httpx.request",
        lambda method, path, *, headers, json, timeout: FakeResponse(
            headers={"Content-Range": "0-0/42"}
        ),
    )
    out = _client_with().table("usage_logs").select("id", count="exact").execute()
    assert out.count == 42


def test_upsert_sends_resolution_and_on_conflict(monkeypatch):
    calls = {}
    monkeypatch.setattr(
        "app.services.supabase_client.httpx.request",
        lambda method, path, *, headers, json, timeout: calls.update(
            method=method, path=path, headers=headers, body=json
        )
        or FakeResponse(status_code=200),
    )
    out = (
        _client_with()
        .table("usage_logs")
        .upsert({"identity_key": "k", "day": "2026-09-11"}, on_conflict="identity_key,day")
        .execute()
    )
    assert calls["method"] == "POST"
    assert "on_conflict=identity_key,day" in calls["path"]
    assert "resolution=merge-duplicates" in calls["headers"]["Prefer"]
    assert calls["body"] == {"identity_key": "k", "day": "2026-09-11"}
    assert out.data == []


def test_update_and_delete_verbs(monkeypatch):
    calls = []
    monkeypatch.setattr(
        "app.services.supabase_client.httpx.request",
        lambda method, path, *, headers, json, timeout: calls.append((method, path))
        or FakeResponse(status_code=200),
    )
    _client_with().table("profiles").update({"plan": "pro"}).eq("id", "u1").execute()
    _client_with().table("profiles").delete().eq("id", "u1").execute()
    assert calls[0][0] == "PATCH"
    assert "id=eq.u1" in calls[0][1]
    assert calls[1][0] == "DELETE"


def test_transport_error_raises(monkeypatch):
    monkeypatch.setattr(
        "app.services.supabase_client.httpx.request",
        lambda method, path, *, headers, json, timeout: FakeResponse(
            status_code=400, text='{"message":"oops"}'
        ),
    )
    with pytest.raises(SupabaseRestError):
        _client_with().table("profiles").select().execute()