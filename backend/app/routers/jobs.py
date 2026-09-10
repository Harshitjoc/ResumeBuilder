import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from pydantic import BaseModel

from app import config
from app.routers.llm import (
    _coerce_ats_check,
    _service,
    ApiKeys,
    _as_dict,
    _normalize_customization,
)
from app.services.entitlements import get_plan, is_pro
from app.services.prompts import (
    ats_check_prompt,
    customize_prompt,
    sanitize_target_user,
)

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

_jobs: dict[str, dict[str, Any]] = {}


class JobSubmit(BaseModel):
    kind: str
    payload: dict[str, Any]
    apiKeys: ApiKeys
    targetUser: str | None = None


def _run_customize(job_id: str, payload: dict, api_keys: ApiKeys, target_user: str | None):
    try:
        llm = _service(api_keys)
        raw = llm.generate_json(
            customize_prompt(
                payload.get("resume", {}),
                payload.get("job", {}),
                payload.get("compatibility", {}),
                target_user=target_user,
            ),
            max_tokens=4000,
        )
        data = _as_dict(raw)
        customizations = [
            normalized
            for item in data.get("customizations", [])
            if (normalized := _normalize_customization(item)) is not None
        ]
        data["customizations"] = customizations
        _jobs[job_id]["result"] = data
        _jobs[job_id]["status"] = "done"
        _jobs[job_id]["finishedAt"] = datetime.now(timezone.utc).isoformat()
    except Exception as e:
        _jobs[job_id]["status"] = "error"
        _jobs[job_id]["error"] = str(e)
        _jobs[job_id]["finishedAt"] = datetime.now(timezone.utc).isoformat()


def _run_ats_file(job_id: str, payload: dict, api_keys: ApiKeys, target_user: str | None):
    try:
        llm = _service(api_keys)
        raw = llm.generate_json(
            ats_check_prompt(
                payload.get("resume", {}),
                payload.get("job"),
                target_user=target_user,
            ),
            max_tokens=2000,
        )
        _jobs[job_id]["result"] = _coerce_ats_check(raw)
        _jobs[job_id]["status"] = "done"
        _jobs[job_id]["finishedAt"] = datetime.now(timezone.utc).isoformat()
    except Exception as e:
        _jobs[job_id]["status"] = "error"
        _jobs[job_id]["error"] = str(e)
        _jobs[job_id]["finishedAt"] = datetime.now(timezone.utc).isoformat()


@router.post("/")
async def submit_job(
    body: JobSubmit,
    background_tasks: BackgroundTasks,
    x_client_key: str | None = Header(None),
    x_user_id: str | None = Header(None),
):
    identity = x_client_key or ""
    plan = get_plan(identity, x_user_id)
    if not is_pro(plan, x_user_id, identity_key=identity):
        raise HTTPException(status_code=403, detail="This feature requires Pro. Upgrade from /upgrade")

    job_id = uuid.uuid4().hex[:12]
    target = sanitize_target_user(body.targetUser) if body.targetUser else None
    _jobs[job_id] = {
        "status": "running",
        "result": None,
        "error": None,
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "finishedAt": None,
    }

    if body.kind == "customize":
        background_tasks.add_task(_run_customize, job_id, body.payload, body.apiKeys, target)
    elif body.kind == "ats-file":
        background_tasks.add_task(_run_ats_file, job_id, body.payload, body.apiKeys, target)
    else:
        _jobs[job_id]["status"] = "error"
        _jobs[job_id]["error"] = f"Unknown kind: {body.kind}"
        _jobs[job_id]["finishedAt"] = datetime.now(timezone.utc).isoformat()

    return {"jobId": job_id}


@router.get("/{job_id}")
async def get_job(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"jobId": job_id, **job}
