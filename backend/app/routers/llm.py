from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.llm import LLMService
from app.services.prompts import (
    compatibility_prompt,
    customize_prompt,
    job_parsing_prompt,
    professional_summary_prompt,
)

router = APIRouter(prefix="/api/llm", tags=["llm"])


class ApiKeys(BaseModel):
    provider: str
    apiKey: str | None = None
    model: str | None = None


class GenerateSummaryRequest(BaseModel):
    resume: dict[str, Any]
    apiKeys: ApiKeys


class ParseJobRequest(BaseModel):
    jobText: str
    apiKeys: ApiKeys


class AnalyzeCompatibilityRequest(BaseModel):
    resume: dict[str, Any]
    job: dict[str, Any]
    apiKeys: ApiKeys


class CustomizeResumeRequest(BaseModel):
    resume: dict[str, Any]
    job: dict[str, Any]
    compatibility: dict[str, Any]
    apiKeys: ApiKeys


def _service(keys: ApiKeys) -> LLMService:
    try:
        return LLMService(provider=keys.provider, api_key=keys.apiKey, model=keys.model)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/generate-summary")
async def generate_summary(req: GenerateSummaryRequest):
    llm = _service(req.apiKeys)
    try:
        result = llm.generate_json(professional_summary_prompt(req.resume), max_tokens=800)
        summary = result.get("summary") or result.get("professional_summary") or ""
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {e}")


@router.post("/parse-job")
async def parse_job(req: ParseJobRequest):
    llm = _service(req.apiKeys)
    try:
        parsed = llm.generate_json(job_parsing_prompt(req.jobText), max_tokens=2000)
        return {"parsed": parsed}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {e}")


@router.post("/analyze-compatibility")
async def analyze_compatibility(req: AnalyzeCompatibilityRequest):
    llm = _service(req.apiKeys)
    try:
        analysis = llm.generate_json(
            compatibility_prompt(req.resume, req.job), max_tokens=2000
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
            customize_prompt(req.resume, req.job, req.compatibility),
            max_tokens=4000,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {e}")