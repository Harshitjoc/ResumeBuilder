"""Verified-identity dependencies for the API.

In Supabase mode (SUPABASE_URL + a JWT secret or JWKS URL configured) every
request is authenticated from a Supabase session JWT carried in
`Authorization: Bearer <token>`. Legacy-format projects verify HS256 with the
shared `SUPABASE_JWT_SECRET`; new-format projects verify against the project
JWKS endpoint (`SUPABASE_JWKS_URL`), which may publish ES256/RS256/HS256 keys.
No client-supplied header is ever trusted for identity.

When Supabase is NOT configured (local dev / tests / browser-local MVP) the
legacy header identity (X-Client-Key / X-User-Id) is used and no JWT
verification happens. This keeps existing tests and local tooling working
while production runs fully verified.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import jwt as pyjwt
from fastapi import Depends, Header, HTTPException, Request

from app import config


@dataclass
class AuthContext:
    user_id: str | None = None
    client_key: str | None = None
    is_anonymous: bool = False
    role: str | None = None
    error: str | None = None

    @property
    def identity_key(self) -> str:
        return self.user_id or self.client_key or ""


def supabase_enabled() -> bool:
    return bool(config.SUPABASE_URL and (config.SUPABASE_JWT_SECRET or config.SUPABASE_JWKS_URL))


_jwk_client: Optional[pyjwt.PyJWKClient] = None


def _get_jwk_client() -> Optional[pyjwt.PyJWKClient]:
    global _jwk_client
    if _jwk_client is None and config.SUPABASE_JWKS_URL:
        _jwk_client = pyjwt.PyJWKClient(config.SUPABASE_JWKS_URL)
    return _jwk_client


def decode_token(token: str, *, error_status: int = 401) -> dict:
    """Verify a Supabase session token and return its claims.

    Raises HTTPException(error_status) on any failure.
    """
    options: dict = {
        "require": ["exp", "sub"],
        "verify_aud": True,
        "verify_iat": False,  # tolerate clock skew between client and GoTrue
    }
    try:
        if config.SUPABASE_JWT_SECRET:
            return pyjwt.decode(
                token,
                config.SUPABASE_JWT_SECRET,
                algorithms=['HS256'],
options=options,
                leeway=30,
                audience="authenticated",
            )
        client = _get_jwk_client()
        if not client:
            raise HTTPException(status_code=error_status, detail="Invalid authentication token")
        signing_key = client.get_signing_key_from_jwt(token)
        return pyjwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256", "HS256"],
            options=options,
            leeway=30,
            audience="authenticated",
        )
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=error_status, detail="Token expired")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=error_status, detail="Invalid authentication token")


def _verify_jwt(token: str) -> AuthContext:
    payload = decode_token(token)
    return AuthContext(
        user_id=payload.get("sub"),
        is_anonymous=bool(payload.get("is_anonymous", False)),
        role=payload.get("role"),
    )


def get_user_http(
    request: Request,
    x_client_key: str | None = Header(None),
    x_user_id: str | None = Header(None),
) -> AuthContext:
    if supabase_enabled():
        authorization = request.headers.get("Authorization") or ""
        if authorization.strip():
            if not authorization.startswith("Bearer "):
                raise HTTPException(status_code=401, detail="Invalid authentication token")
            return _verify_jwt(authorization[7:].strip())
        return AuthContext()
    return AuthContext(
        user_id=x_user_id or None,
        client_key=(x_client_key or "").strip() or None,
    )


def _identity_or_401(ctx: AuthContext) -> AuthContext:
    if not ctx.identity_key or ctx.error:
        raise HTTPException(status_code=401, detail=(ctx.error or "Authentication required"))
    return ctx


def _profile_role(user_id: str) -> str | None:
    from app.services.entitlements import _supabase_client

    sb = _supabase_client()
    if not sb:
        return None
    try:
        res = sb.table("profiles").select("role").eq("id", user_id).limit(1).execute()
        return res.data[0].get("role") if res.data else None
    except Exception:
        return None


async def require_active_user(ctx: AuthContext = Depends(get_user_http)) -> AuthContext:
    return _identity_or_401(ctx)


async def require_user(ctx: AuthContext = Depends(get_user_http)) -> AuthContext:
    _identity_or_401(ctx)
    if ctx.is_anonymous:
        raise HTTPException(status_code=403, detail="Create a free account to continue")
    return ctx


async def require_pro(ctx: AuthContext = Depends(get_user_http)) -> AuthContext:
    _identity_or_401(ctx)
    if ctx.is_anonymous:
        raise HTTPException(
            status_code=403,
            detail="This feature requires an account. Sign in to continue",
        )
    from app.services.entitlements import get_plan, is_pro

    plan = get_plan(ctx.user_id or "", ctx.user_id)
    if not is_pro(plan, ctx.user_id, identity_key=ctx.identity_key):
        raise HTTPException(status_code=403, detail="This feature requires Pro. Upgrade from /upgrade")
    return ctx


async def require_admin(
    request: Request,
    ctx: AuthContext = Depends(get_user_http),
) -> AuthContext:
    if not supabase_enabled():
        authorization = request.headers.get("Authorization") or ""
        token = authorization[7:].strip() if authorization.startswith("Bearer ") else ""
        if token != config.ADMIN_TOKEN:
            raise HTTPException(status_code=401, detail="Admin token required")
        return AuthContext(client_key="admin")
    _identity_or_401(ctx)
    if not ctx.user_id or _profile_role(ctx.user_id) != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return ctx


# Re-export for callers that build contexts programmatically (tests).
OptionalAuth = Optional[AuthContext]
