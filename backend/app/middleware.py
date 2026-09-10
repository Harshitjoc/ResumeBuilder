"""HTTP hardening middleware: security headers, per-IP rate limiting, body caps.

Applied globally. Rate limits are in-memory (per-process) — sufficient for a
demo-scale app; swap for a Redis/Cloudflare-backed limiter before multi-node
deployment.
"""
import time
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

MAX_JSON_BYTES = 2 * 1024 * 1024  # 2 MB default body cap for JSON APIs

# scope -> (max requests, window seconds). The longest prefixes win.
RATE_LIMITS = {
    "/api/llm": (60, 900),
    "/api/ats": (30, 900),
    "/api/jobs": (30, 900),
    "/api/auth": (60, 900),
    "/api/payments/request": (10, 900),
    "default": (300, 900),
}

EXEMPT_PREFIXES = ("/api/health", "/api/shares", "/api/payments/meta")

SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}

LOOPBACK_HOSTS = ("testclient", "127.0.0.1", "::1", "localhost")


def pick_limit(path: str) -> tuple[int, int] | None:
    for prefix, limit in sorted(RATE_LIMITS.items(), key=lambda kv: len(kv[0]), reverse=True):
        if prefix != "default" and path.startswith(prefix):
            return limit
    limit = RATE_LIMITS.get("default")
    return limit


class RateLimitStore:
    def __init__(self, limits: dict[str, tuple[int, int]] | None = None) -> None:
        self._limits = limits or RATE_LIMITS
        self._hits: defaultdict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, path: str) -> tuple[bool, int | None, int | None]:
        """Returns (allowed, limit, remaining_or_retry_after)."""
        for prefix, (max_req, window) in sorted(self._limits.items(), key=lambda kv: len(kv[0]), reverse=True):
            if prefix == "default":
                continue
            if path.startswith(prefix):
                return self._window(key, max_req, window)
        max_req, window = self._limits.get("default", (300, 900))
        return self._window(key, max_req, window)

    def _window(self, key: str, max_req: int, window: int) -> tuple[bool, int, int]:
        now = time.time()
        q = self._hits[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= max_req:
            retry = max(1, int(window - (now - q[0])))
            return False, max_req, retry
        q.append(now)
        return True, max_req, max(0, max_req - len(q))

    def reset(self, key: str | None = None) -> None:
        if key:
            self._hits.pop(key, None)
        else:
            self._hits.clear()


class HardeningMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self.store = RateLimitStore()

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if any(path.startswith(p) for p in EXEMPT_PREFIXES):
            return await self._finalize(await call_next(request))

        if request.method in ("POST", "PUT", "PATCH"):
            length = request.headers.get("content-length")
            if length and length.isdigit() and int(length) > MAX_JSON_BYTES:
                return JSONResponse(status_code=413, content={"detail": "Request body too large"})

        ip = request.client.host if request.client else "unknown"
        if ip not in LOOPBACK_HOSTS:
            allowed, _, retry = self.store.allow(f"{ip}::{request.method}", path)
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={"detail": {"detail": "Too many requests", "retry_after": retry}},
                    headers={"Retry-After": str(retry)},
                )

        return await self._finalize(await call_next(request))

    async def _finalize(self, response):
        for header, value in SECURITY_HEADERS.items():
            response.headers.setdefault(header, value)
        return response