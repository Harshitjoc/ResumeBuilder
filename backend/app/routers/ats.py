import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app import config
from app.deps import AuthContext, get_user_http
from app.routers.llm import _coerce_ats_check, _service, ApiKeys
from app.routers.upload import _extract_docx, _extract_pdf
from app.services.entitlements import get_plan, is_pro
from app.services.prompts import file_ats_prompt, sanitize_target_user

router = APIRouter(prefix="/api/ats", tags=["ats"])

MAX_SIZE = 10 * 1024 * 1024

REQUIRED_HEADERS = ["contact", "education", "work", "projects", "skills", "experience", "summary"]


def _deterministic_checks(text: str) -> dict[str, Any]:
    lower = text.lower()
    words = text.split()
    word_count = len(words)

    missing_headers = []
    for h in REQUIRED_HEADERS:
        if not re.search(r"\b" + h + r"\b", lower):
            missing_headers.append(h)

    email_present = bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", text))
    phone_present = bool(re.search(r"(?:\+?\d[\d\s().-]{7,})", text))
    contact_present = email_present or phone_present

    structure_notes: list[str] = []
    if word_count < 200:
        structure_notes.append(f"Resume is quite short ({word_count} words)")
    if word_count > 1500:
        structure_notes.append(f"Resume is very long ({word_count} words)")

    caps_words = [w for w in words if w.isupper() and len(w) > 2]
    caps_density = len(caps_words) / max(word_count, 1)
    formatting_notes: list[str] = []
    if caps_density > 0.15:
        formatting_notes.append("Heavy ALL-CAPS usage may confuse ATS parsers")

    lines = text.split("\n")
    bullet_lines = [l for l in lines if l.strip().startswith(("-", "*", "\u2022"))]
    if len(lines) > 10 and len(bullet_lines) / max(len(lines), 1) < 0.2:
        formatting_notes.append("Low bullet density — consider using more bullet points")

    score = 100
    score -= 5 * len(missing_headers)
    if not contact_present:
        score -= 15
    score = max(0, min(100, score))

    return {
        "overall_score": score,
        "keyword_notes": [],
        "structure_notes": structure_notes,
        "formatting_notes": formatting_notes,
        "missing_headers": missing_headers,
        "parseability_notes": [],
        "contact_present": contact_present,
        "action_items": [],
    }


@router.post("/file")
async def ats_file(
    file: UploadFile,
    job: str | None = None,
    apiKeys: str = "{}",
    targetUser: str | None = None,
    auth: AuthContext = Depends(get_user_http),
):
    identity = auth.identity_key or ""
    plan = get_plan(identity, auth.user_id)
    if not is_pro(plan, auth.user_id, identity_key=identity):
        raise HTTPException(status_code=403, detail="This feature requires Pro. Upgrade from /upgrade")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    ext = (file.filename or "").lower().rsplit(".", 1)[-1] if "." in (file.filename or "") else ""

    try:
        if ext == "pdf":
            text = _extract_pdf(data)
        elif ext == "docx":
            text = _extract_docx(data)
        elif ext == "txt":
            text = data.decode("utf-8", errors="replace").strip()
        else:
            raise HTTPException(status_code=415, detail="Unsupported file type (use .pdf, .docx, or .txt)")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not extract text: {e}")

    if not text:
        raise HTTPException(status_code=422, detail="No readable text found in the file")

    det = _deterministic_checks(text)

    job_data = None
    if job:
        try:
            import json
            job_data = json.loads(job)
        except Exception:
            pass

    keys = ApiKeys.model_validate_json(apiKeys)
    target = sanitize_target_user(targetUser) if targetUser else None

    try:
        llm = _service(keys)
        raw = llm.generate_json(
            file_ats_prompt(text, job_data, target_user=target),
            max_tokens=2000,
        )
        llm_result = _coerce_ats_check(raw)
        check = llm_result.get("check", {})
        merged = {**det, **check}
        merged["missing_headers"] = list(set(det.get("missing_headers", []) + check.get("missing_headers", [])))
        merged["contact_present"] = det["contact_present"] or check.get("contact_present", False)
        return {"check": merged, "text": text[:2000]}
    except Exception:
        return {"check": det, "text": text[:2000]}
