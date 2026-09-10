from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.extract import (
    build_contact_confidence,
    build_evidence,
    extract_contacts,
)
from app.services.llm import LLMService
from app.services.prompts import (
    analyze_resume_prompt,
    ats_check_prompt,
    compatibility_prompt,
    cover_letter_prompt,
    customize_prompt,
    interview_prep_prompt,
    job_parsing_prompt,
    parse_resume_prompt,
    professional_summary_prompt,
    sanitize_target_user,
)

router = APIRouter(prefix="/api/llm", tags=["llm"])

VALID_PERSONAS = ("recent-grad", "working-professional", "career-switcher")


class ApiKeys(BaseModel):
    provider: str
    apiKey: str | None = None
    model: str | None = None


class GenerateSummaryRequest(BaseModel):
    resume: dict[str, Any]
    apiKeys: ApiKeys
    targetUser: str | None = None


class ParseJobRequest(BaseModel):
    jobText: str
    apiKeys: ApiKeys
    targetUser: str | None = None


class AnalyzeCompatibilityRequest(BaseModel):
    resume: dict[str, Any]
    job: dict[str, Any]
    apiKeys: ApiKeys
    targetUser: str | None = None


class CustomizeResumeRequest(BaseModel):
    resume: dict[str, Any]
    job: dict[str, Any]
    compatibility: dict[str, Any]
    apiKeys: ApiKeys
    targetUser: str | None = None


class ParseResumeRequest(BaseModel):
    resumeText: str
    apiKeys: ApiKeys
    targetUser: str | None = None


class AnalyzeResumeRequest(BaseModel):
    resume: dict[str, Any]
    apiKeys: ApiKeys
    targetUser: str | None = None


class AtsCheckRequest(BaseModel):
    resume: dict[str, Any]
    job: dict[str, Any] | None = None
    apiKeys: ApiKeys
    targetUser: str | None = None


class GenerateCoverLetterRequest(BaseModel):
    resume: dict[str, Any]
    job: dict[str, Any]
    apiKeys: ApiKeys
    targetUser: str | None = None


class GenerateInterviewPrepRequest(BaseModel):
    resume: dict[str, Any]
    job: dict[str, Any]
    apiKeys: ApiKeys
    targetUser: str | None = None


def _service(keys: ApiKeys) -> LLMService:
    try:
        return LLMService(provider=keys.provider, api_key=keys.apiKey, model=keys.model)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --------------------------------------------------------------------------
# Lenient coercion for imperfect model output (small local models such as
# qwen3:0.6b produce structurally imperfect JSON). Coerce, never reject.
# --------------------------------------------------------------------------
def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def _as_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        if item is None:
            continue
        if isinstance(item, list):
            out.extend(_as_str_list(item))
        else:
            text = str(item).strip()
            if text:
                out.append(text)
    return out


def _as_int(value: Any, default: int = 0) -> int:
    if isinstance(value, bool):
        return default
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        text = value.strip()
        if text.lstrip("+-").isdigit():
            return int(text)
    return default


def _as_score(value: Any, default: int = 0) -> int:
    score = _as_int(value, default)
    return max(0, min(100, score))


def _as_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in ("true", "yes", "1")
    return default


def _as_change_severity(value: Any) -> str:
    if value in ("low", "medium", "high"):
        return value
    return "medium"


def _coerce_ats_check(raw: Any) -> dict[str, Any]:
    data = _as_dict(raw)
    return {
        "check": {
            "overall_score": _as_score(data.get("overall_score")),
            "keyword_notes": _as_str_list(data.get("keyword_notes")),
            "structure_notes": _as_str_list(data.get("structure_notes")),
            "formatting_notes": _as_str_list(data.get("formatting_notes")),
            "missing_headers": _as_str_list(data.get("missing_headers")),
            "parseability_notes": _as_str_list(data.get("parseability_notes")),
            "contact_present": _as_bool(data.get("contact_present")),
            "action_items": _as_str_list(data.get("action_items")),
        }
    }


def _coerce_cover_letter(raw: Any) -> dict[str, Any]:
    data = _as_dict(raw)
    letter = _as_str(data.get("letter")) or _as_str(data.get("cover_letter"))
    return {"letter": letter}


def _coerce_interview_prep(raw: Any) -> dict[str, Any]:
    data = _as_dict(raw)
    return {
        "prep": {
            "likely_questions": _as_str_list(data.get("likely_questions")),
            "company_research": _as_str_list(data.get("company_research")),
            "talking_points": _as_str_list(data.get("talking_points")),
            "questions_to_ask": _as_str_list(data.get("questions_to_ask")),
        }
    }


def _normalize_customization(item: Any) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    is_authentic = item.get("is_authentic")
    if not isinstance(is_authentic, bool):
        is_authentic = True

    confidence = item.get("confidence")
    if confidence not in ("high", "medium", "low"):
        if is_authentic is False:
            confidence = "low"
        else:
            severity = _as_change_severity(item.get("change_severity"))
            confidence = {"low": "high", "medium": "medium", "high": "low"}.get(
                severity, "low"
            )

    normalized = dict(item)
    normalized["is_authentic"] = is_authentic
    normalized["confidence"] = confidence
    return normalized


def _coerce_parsed_resume(raw: Any) -> dict[str, Any]:
    data = _as_dict(raw)
    contact = _as_dict(data.get("contact"))
    data["contact"] = {
        "fullName": _as_str(contact.get("fullName")),
        "email": _as_str(contact.get("email")),
        "phone": _as_str(contact.get("phone")),
        "linkedin": _as_str(contact.get("linkedin")),
        "github": _as_str(contact.get("github")),
        "website": _as_str(contact.get("website")),
    }
    return data


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------
@router.post("/generate-summary")
async def generate_summary(req: GenerateSummaryRequest):
    llm = _service(req.apiKeys)
    try:
        result = llm.generate_json(
            professional_summary_prompt(
                req.resume, target_user=sanitize_target_user(req.targetUser)
            ),
            max_tokens=800,
        )
        summary = result.get("summary") or result.get("professional_summary") or ""
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {e}")


@router.post("/parse-job")
async def parse_job(req: ParseJobRequest):
    llm = _service(req.apiKeys)
    try:
        parsed = llm.generate_json(
            job_parsing_prompt(
                req.jobText, target_user=sanitize_target_user(req.targetUser)
            ),
            max_tokens=2000,
        )
        return {"parsed": parsed}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {e}")


@router.post("/analyze-compatibility")
async def analyze_compatibility(req: AnalyzeCompatibilityRequest):
    llm = _service(req.apiKeys)
    try:
        analysis = llm.generate_json(
            compatibility_prompt(
                req.resume, req.job, target_user=sanitize_target_user(req.targetUser)
            ),
            max_tokens=2000,
        )
        return {
            "analysis": {
                "jobTitle": req.job.get("job_title", ""),
                "company": req.job.get("company", ""),
                "seniorityLevel": req.job.get("seniority_level", ""),
                "roleType": req.job.get("role_type", ""),
                "requiredSkills": req.job.get("required_skills", []),
                "preferredSkills": req.job.get("preferred_skills", []),
                "yearsExperience": str(req.job.get("years_experience", "")),
                "keyResponsibilities": req.job.get("key_responsibilities", []),
                "compatibilityScore": analysis.get("overall_score", 0),
                "skillMatchPercentage": analysis.get("skill_match_percentage", 0),
                "skillStrengths": analysis.get("matching_skills", []),
                "skillGaps": analysis.get("missing_skills", []),
                "concerns": analysis.get("concerns", []),
                "recommendation": analysis.get("recommendation", ""),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {e}")


@router.post("/customize-resume")
async def customize_resume(req: CustomizeResumeRequest):
    llm = _service(req.apiKeys)
    try:
        result = llm.generate_json(
            customize_prompt(
                req.resume,
                req.job,
                req.compatibility,
                target_user=sanitize_target_user(req.targetUser),
            ),
            max_tokens=4000,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {e}")

    data = _as_dict(result)
    customizations = [
        normalized
        for item in data.get("customizations", [])
        if (normalized := _normalize_customization(item)) is not None
    ]
    data["customizations"] = customizations
    return data


@router.post("/parse-resume")
async def parse_resume(req: ParseResumeRequest):
    llm = _service(req.apiKeys)
    try:
        raw = llm.generate_json(
            parse_resume_prompt(
                req.resumeText, target_user=sanitize_target_user(req.targetUser)
            ),
            max_tokens=4000,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {e}")

    parsed = _coerce_parsed_resume(raw)
    extracted = extract_contacts(req.resumeText)
    contact = parsed.get("contact", {})
    for key, value in extracted.items():
        if not str(contact.get(key) or "").strip():
            contact[key] = value
    parsed["contact"] = contact
    contact_confidence = build_contact_confidence(contact, extracted)
    evidence = build_evidence(parsed)
    return {"parsed": parsed, "evidence": evidence, "contactConfidence": contact_confidence}


@router.post("/analyze-resume")
async def analyze_resume(req: AnalyzeResumeRequest):
    llm = _service(req.apiKeys)
    try:
        analysis = llm.generate_json(
            analyze_resume_prompt(
                req.resume, target_user=sanitize_target_user(req.targetUser)
            ),
            max_tokens=2000,
        )
        return {"analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {e}")


@router.post("/ats-check")
async def ats_check(req: AtsCheckRequest):
    llm = _service(req.apiKeys)
    try:
        raw = llm.generate_json(
            ats_check_prompt(
                req.resume,
                req.job,
                target_user=sanitize_target_user(req.targetUser),
            ),
            max_tokens=2000,
        )
        return _coerce_ats_check(raw)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {e}")


@router.post("/generate-cover-letter")
async def generate_cover_letter(req: GenerateCoverLetterRequest):
    llm = _service(req.apiKeys)
    try:
        raw = llm.generate_json(
            cover_letter_prompt(
                req.resume,
                req.job,
                target_user=sanitize_target_user(req.targetUser),
            ),
            max_tokens=1000,
        )
        return _coerce_cover_letter(raw)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {e}")


@router.post("/generate-interview-prep")
async def generate_interview_prep(req: GenerateInterviewPrepRequest):
    llm = _service(req.apiKeys)
    try:
        raw = llm.generate_json(
            interview_prep_prompt(
                req.resume,
                req.job,
                target_user=sanitize_target_user(req.targetUser),
            ),
            max_tokens=2000,
        )
        return _coerce_interview_prep(raw)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {e}")