from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.config import CORS_ORIGINS
from app.routers import admin, ats, jobs, llm, me, payments, shares, upload

app = FastAPI(title="Resume Builder API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(llm.router)
app.include_router(upload.router)
app.include_router(payments.router)
app.include_router(shares.router)
app.include_router(ats.router)
app.include_router(jobs.router)
app.include_router(me.router)
app.include_router(admin.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


def _bootstrap_admin_email() -> None:
    """Promote the configured ADMIN_EMAIL to an admin profile at startup.

    Best-effort and never fatal: without Supabase, or when the email is
    missing/unknown, this is a silent no-op.
    """
    if not (config.ADMIN_EMAIL and config.SUPABASE_URL and config.SUPABASE_SERVICE_KEY):
        return
    try:
        from supabase import create_client

        sb = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
        users = sb.auth.admin.list_users()
        match = next((u for u in users.data if u.email == config.ADMIN_EMAIL), None)
        if not match:
            return
        sb.table("profiles").upsert(
            {"id": match.id, "role": "admin"},
            on_conflict="id",
        ).execute()
    except Exception:
        pass


@app.on_event("startup")
async def _ensure_data_dir():
    (Path(__file__).resolve().parent.parent / "data").mkdir(exist_ok=True)


@app.on_event("startup")
async def _bootstrap_admin():
    _bootstrap_admin_email()