"""Account-linking endpoints for the anonymous -> permanent conversion flow."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import config
from app.deps import AuthContext, decode_token, require_user, supabase_enabled
from app.services import audit
from app.services.conversion import claim_anonymous_rows

router = APIRouter(prefix="/api/auth", tags=["auth"])


class ClaimRequest(BaseModel):
    anon_token: str


@router.post("/claim-anonymous")
async def claim_anonymous(
    payload: ClaimRequest,
    ctx: AuthContext = Depends(require_user),
):
    """Reassign an anonymous user's cloud rows to the signed-in account.

    The client is signed in (authenticated, non-anonymous) and passes the
    JWT of the anonymous session whose data should be claimed. The token is
    verified with the same Supabase JWT secret (or JWKS); the anonymous uid
    is then migrated to the current user via the service-role client.
    """
    if not supabase_enabled():
        raise HTTPException(status_code=503, detail="Supabase not configured")
    if not ctx.user_id:
        raise HTTPException(status_code=403, detail="Create a free account to continue")

    try:
        claims = decode_token(payload.anon_token, error_status=400)
    except HTTPException:
        # Preserve the client-facing contract: any failed anon-token decode
        # surfaces as a 400 invalid-anonymous-token error.
        raise HTTPException(status_code=400, detail="Invalid anonymous token")

    anon_uid = claims.get("sub")
    if not anon_uid or not claims.get("is_anonymous"):
        raise HTTPException(status_code=400, detail="Token is not from an anonymous session")
    if anon_uid == ctx.user_id:
        raise HTTPException(status_code=400, detail="Anonymous token already matches this account")

    try:
        result = claim_anonymous_rows(anon_uid, ctx.user_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    audit.log(
        actor_user_id=ctx.user_id,
        action="claim_anonymous",
        target_type="user",
        target_id=anon_uid,
        after_data={"migrated": result.get("migrated"), "errors": result.get("errors")},
    )

    return {"ok": True, **result}