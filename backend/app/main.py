from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routers import ats, jobs, llm, me, payments, shares, upload

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


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.on_event("startup")
async def _ensure_data_dir():
    (Path(__file__).resolve().parent.parent / "data").mkdir(exist_ok=True)