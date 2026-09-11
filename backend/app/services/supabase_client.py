"""Supabase client factory that works on BOTH key formats.

supabase-py v2 validates `create_client()` keys as JWTs, so new-format keys
(`sb_publishable_...` / `sb_secret_...`) are rejected with "Invalid API key".
Legacy JWT-secret projects keep using supabase-py unchanged.

New-format projects fall back to a PostgREST shim backed by httpx. Supabase's
gateway maps a qualifying `apikey`/`Authorization: Bearer` header to the
service-role session, so raw REST works with the same key. The shim exposes the
subset of the supabase-py builder surface used across this codebase:
table().select(c, count=)/insert()/update()/upsert()/delete(),
.eq()/limit()/order(), and results exposing .data/.count.
"""
import re
from typing import Any

import httpx

from app import config

_JWT_KEY_RE = re.compile(r"^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$")


class SupabaseRestError(RuntimeError):
    pass


class _Result:
    def __init__(self, data: list, count: int | None = None):
        self.data = data or []
        self.count = count


class _Builder:
    def __init__(self, client: "_RestClient", table: str):
        self._client = client
        self._table = table
        self._verb = "select"
        self._columns = "*"
        self._count = None
        self._payload: Any = None
        self._on_conflict: str | None = None
        self._filters: list[tuple[str, str]] = []
        self._order: list[tuple[str, bool]] = []
        self._limit: int | None = None

    def select(self, columns: str = "*", count: str | None = None) -> "_Builder":
        self._verb = "select"
        self._columns = columns
        self._count = count
        return self

    def insert(self, data: Any) -> "_Builder":
        self._verb = "insert"
        self._payload = data
        return self

    def update(self, data: Any) -> "_Builder":
        self._verb = "update"
        self._payload = data
        return self

    def delete(self) -> "_Builder":
        self._verb = "delete"
        return self

    def upsert(self, data: Any, on_conflict: str | None = None) -> "_Builder":
        self._verb = "upsert"
        self._payload = data
        self._on_conflict = on_conflict
        return self

    def eq(self, column: str, value: Any) -> "_Builder":
        self._filters.append((column, str(value)))
        return self

    def limit(self, n: int) -> "_Builder":
        self._limit = n
        return self

    def order(self, column: str, desc: bool = False) -> "_Builder":
        self._order.append((column, desc))
        return self

    def execute(self) -> _Result:
        return self._client._request(self)


class _RestClient:
    def __init__(self, url: str, key: str):
        self.url = url.rstrip("/")
        self.key = key

    def table(self, name: str) -> _Builder:
        return _Builder(self, name)

    def _headers(self, extra: dict | None = None) -> dict:
        headers = {"apikey": self.key, "Authorization": f"Bearer {self.key}"}
        if extra:
            headers.update(extra)
        return headers

    def _request(self, b: _Builder) -> _Result:
        params, qsep = [], "?"
        for col, val in b._filters:
            params.append(f"{col}=eq.{val}")
        for col, desc in b._order:
            params.append(f"order={col}.{'desc' if desc else 'asc'}")
        if b._verb == "select" and b._limit is not None:
            params.append(f"limit={b._limit}")
        if b._verb == "upsert" and b._on_conflict:
            params.append(f"on_conflict={b._on_conflict}")
        qs = ("?" + "&".join(params)) if params else ""

        path = f"/rest/v1/{b._table}{qs}"
        prefer = ["return=representation"]
        headers: dict = {"Accept": "application/json"}

        if b._verb == "select":
            base_headers: dict = {"Accept": "application/json"}
            if b._count:
                base_headers["Prefer"] = "count=exact"
                base_headers["Range"] = "0-0"
                headers = base_headers
            else:
                headers = base_headers
            resp = self._send("GET", path, headers=headers)
            count = None
            if b._count:
                cr = resp.headers.get("Content-Range", "")
                if "/" in cr:
                    try:
                        count = int(cr.rsplit("/", 1)[1])
                    except ValueError:
                        count = None
            return _Result(resp.json() or [], count)

        if b._verb == "insert":
            headers["Prefer"] = "return=representation"
            resp = self._send("POST", path, headers=headers, json=b._payload)
            return _Result(resp.json() or [])

        if b._verb == "upsert":
            headers["Prefer"] = "return=representation,resolution=merge-duplicates"
            resp = self._send("POST", path, headers=headers, json=b._payload)
            return _Result(resp.json() or [])

        if b._verb == "update":
            headers["Prefer"] = "return=representation"
            resp = self._send("PATCH", path, headers=headers, json=b._payload)
            return _Result(resp.json() or [])

        if b._verb == "delete":
            headers["Prefer"] = "return=representation"
            resp = self._send("DELETE", path, headers=headers)
            return _Result(resp.json() or [])

        raise SupabaseRestError(f"unsupported verb {b._verb}")

    def _send(self, method: str, path: str, headers: dict, json=None) -> httpx.Response:
        resp = httpx.request(method, self.url + path, headers=self._headers(headers), json=json, timeout=30)
        if resp.status_code >= 400:
            raise SupabaseRestError(f"Supabase {method} {path}: {resp.status_code} {resp.text[:250]}")
        return resp


def get_client():
    url = config.SUPABASE_URL or ""
    key = config.SUPABASE_SERVICE_KEY or ""
    if not url or not key:
        return None
    if _JWT_KEY_RE.match(key):
        from supabase import create_client
        return create_client(url, key)
    return _RestClient(url, key)