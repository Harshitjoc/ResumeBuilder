"""AI prompt builders.

PROMINENT: These prompts encode the platform's non-negotiable authenticity rules.
The model may rephrase, reorder, and emphasize — but NEVER invent experiences,
skills, dates, degrees, or metrics.
"""
import json
from typing import Any

SORT = "SORT"


def _dump(obj: Any) -> str:
    return json.dumps(obj, indent=2, default=str)


def professional_summary_prompt(resume: dict) -> str:
    return f"""
You are an expert resume writer and career coach. Create a compelling professional
summary for the candidate described below.

CANDIDATE DATA (JSON):
{_dump(resume)}

RULES (NON-NEGOTIABLE):
1. Use ONLY information present in the candidate data.
2. Do NOT invent skills, achievements, years of experience, or metrics.
3. Keep it to 3-4 lines, achievement-focused where facts support it.

Return a JSON object with a single field "summary" containing the summary text.
"""


def job_parsing_prompt(job_text: str) -> str:
    return f"""
You are an expert recruiter and job market analyst. Parse the job posting below
into structured data.

JOB POSTING:
{job_text}

Extract the following and return as JSON with EXACTLY these keys:
{{
  "job_title": "...",
  "company": "...",
  "seniority_level": "entry|mid|senior|lead",
  "role_type": "...",
  "required_skills": ["...", "..."],
  "preferred_skills": ["...", "..."],
  "years_experience": X,
  "key_responsibilities": ["...", "..."],
  "culture_signals": "...",
  "red_flags": []
}}

Do not fabricate fields that are absent from the posting; use empty lists / ""
where unknown.
"""


def compatibility_prompt(resume: dict, job: dict) -> str:
    return f"""
You are a career advisor evaluating fit between a candidate's resume and a job posting.

CANDIDATE RESUME (JSON):
{_dump(resume)}

PARSED JOB (JSON):
{_dump(job)}

Evaluate:
1. SKILL MATCH - which required skills the candidate has (from resume only) vs missing.
2. SENIORITY ALIGNMENT - appropriate / overqualified / underqualified.
3. ROLE TYPE FIT - strong / moderate / weak.
4. INDUSTRY FIT - strong / moderate / none.
5. DEAL BREAKERS - hard requirements the candidate cannot meet even with customization.

Return JSON with EXACTLY these keys:
{{
  "skill_match_percentage": X,
  "matching_skills": ["..."],
  "missing_skills": ["..."],
  "preferred_skills_present": ["..."],
  "seniority_alignment": "...",
  "role_type_fit": "...",
  "industry_fit": "...",
  "deal_breakers": [],
  "overall_score": X,
  "recommendation": "Strong Fit - Proceed with customization" | "Moderate Fit" | "Stretch - Risky" | "Not Recommended",
  "reasoning": "...",
  "concerns": ["..."]
}}

Base the assessment ONLY on what is in the resume. overall_score is 0-100.
"""


def customize_prompt(resume: dict, job: dict, compatibility: dict) -> str:
    return f"""
You are an expert resume optimizer. Customize the candidate's resume for the target
job while maintaining ABSOLUTE authenticity.

SAFETY RULES (NON-NEGOTIABLE - NEVER BREAK):
1. NEVER invent work experience, projects, or skills not in the master resume.
2. NEVER change employment dates, graduation dates, or years of experience.
3. NEVER change degree levels.
4. NEVER modify metrics/numbers.
5. CAN reorder bullets by job relevance.
6. CAN rephrase bullets to match job language (truthful only).
7. CAN reorder skills or sections.
8. CAN suggest keyword additions only if they naturally fit the candidate's real experience.

CANDIDATE MASTER RESUME (JSON):
{_dump(resume)}

PARSED JOB (JSON):
{_dump(job)}

COMPATIBILITY ANALYSIS (JSON):
{_dump(compatibility)}

Return a JSON object with EXACTLY this shape:
{{
  "customizations": [
    {{
      "section": "work_experience",
      "entry_index": 0,
      "change_type": "bullet_reorder_and_rephrase",
      "change_severity": "low|medium|high",
      "original": "...",
      "customized": "...",
      "reason": "...",
      "is_authentic": true,
      "explanation": "..."
    }}
  ],
  "section_recommendations": {{
    "include": ["..."],
    "exclude": ["..."],
    "reason": "..."
  }},
  "keyword_suggestions": [
    {{
      "keyword": "...",
      "location": "...",
      "suggested_text": "...",
      "confidence": "high|medium|low",
      "is_authentic": true
    }}
  ],
  "compatibility_concerns": [],
  "customization_summary": "...",
  "ready_for_verification": true
}}

Empty arrays are preferred over omitting fields.
"""