"""Verified-identity dependencies for the API.

In Supabase mode (SUPABASE_URL + SUPABASE_JWT_SECRET configured) every request
is authenticated from an HS256-signed Supabase JWT carried in
`Authorization: Bearer <token>`. No client-supplied header is ever trusted for
identity.

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
    return bool(config.SUPABASE_URL and config.SUPABASE_JWT_SECRET)


def _verify_jwt(token: str) -> AuthContext:
    try:
        payload = pyjwt.decode(
            token,
            config.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"require": ["exp", "sub"], "verify_aud": True},
            audience="authenticated",
        )
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
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