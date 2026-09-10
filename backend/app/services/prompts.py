"""AI prompt builders.

PROMINENT: These prompts encode the platform's non-negotiable authenticity rules.
The model may rephrase, reorder, and emphasize — but NEVER invent experiences,
skills, dates, degrees, or metrics.
"""
import json
from typing import Any

SORT = "SORT"

VALID_TARGET_USERS = ("recent-grad", "working-professional", "career-switcher")
DEFAULT_TARGET_USER = "working-professional"


def sanitize_target_user(target_user: str | None) -> str | None:
    """Return the target_user only if it is a known persona, else None."""
    if target_user in VALID_TARGET_USERS:
        return target_user
    return None


_PERSONA_GUIDANCE: dict[str, str] = {
    "recent-grad": """PERSONA GUIDANCE (recent-grad):
This candidate is a recent graduate. Emphasize education, coursework, academic
projects, and internships over work history. Make academic and side projects
count by connecting them to the target role where the resume facts support it.
Keep an entry-level framing; never imply years of professional experience that
the resume does not show.""",
    "working-professional": """PERSONA GUIDANCE (working-professional):
This candidate is a working professional. Emphasize measurable impact, career
progression, leadership, and years of relevant experience where the resume
supports it. Do not imply roles, titles, or achievements beyond what the resume
states.""",
    "career-switcher": """PERSONA GUIDANCE (career-switcher):
This candidate is changing careers. Emphasize transferable skills and reframe
experience across industries where the resume facts genuinely support it.

STRONG VERIFICATION CAVEAT (HIGH HALLUCINATION-RISK GROUP):
Career-changers are the highest hallucination-risk group. Every transferable-
skill claim MUST trace to a real line on the resume. Flag any leap with
"user must confirm" and NEVER invent bridging experience, cross-industry roles,
or credentials not explicitly present on the resume.""",
}


def _persona_guidance(target_user: str | None) -> str:
    persona = target_user if target_user in VALID_TARGET_USERS else DEFAULT_TARGET_USER
    return _PERSONA_GUIDANCE[persona]


def _append_persona(prompt: str, target_user: str | None) -> str:
    return prompt + "\n\n" + _persona_guidance(target_user)


def _dump(obj: Any) -> str:
    return json.dumps(obj, indent=2, default=str)


def professional_summary_prompt(resume: dict, target_user: str | None = None) -> str:
    return _append_persona(f"""
You are an expert resume writer and career coach. Create a compelling professional
summary for the candidate described below.

CANDIDATE DATA (JSON):
{_dump(resume)}

RULES (NON-NEGOTIABLE):
1. Use ONLY information present in the candidate data.
2. Do NOT invent skills, achievements, years of experience, or metrics.
3. Keep it to 3-4 lines, achievement-focused where facts support it.

Return a JSON object with a single field "summary" containing the summary text.
""", target_user)


def job_parsing_prompt(job_text: str, target_user: str | None = None) -> str:
    return _append_persona(f"""
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
""", target_user)


def compatibility_prompt(resume: dict, job: dict, target_user: str | None = None) -> str:
    return _append_persona(f"""
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
""", target_user)


def customize_prompt(resume: dict, job: dict, compatibility: dict, target_user: str | None = None) -> str:
    return _append_persona(f"""
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
      "confidence": "high|medium|low",
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
""", target_user)


def parse_resume_prompt(resume_text: str, target_user: str | None = None) -> str:
    return _append_persona(f"""
You are an expert resume parser. Convert the candidate's raw resume text below
into structured data.

RAW RESUME TEXT:
{resume_text}

AUTHENTICITY RULES (NON-NEGOTIABLE):
1. Extract ONLY information explicitly present in the text.
2. Do NOT invent, infer, or embellish skills, dates, titles, companies, or metrics.
3. If a section is absent, return an empty list / empty string for it.
4. Keep bullet points verbatim (minor whitespace cleanup only). Do not rewrite them.

Return a JSON object with EXACTLY these keys:
{{
  "contact": {{
    "fullName": "",
    "email": "",
    "phone": "",
    "linkedin": "",
    "github": "",
    "website": ""
  }},
  "professionalSummary": "",
  "skills": [],
  "experience": [
    {{"jobTitle": "", "company": "", "startDate": "", "endDate": "", "bullets": []}}
  ],
  "education": [
    {{"degree": "", "school": "", "endDate": "", "gpa": ""}}
  ],
  "projects": [
    {{"name": "", "description": "", "link": "", "technologies": []}}
  ],
  "certifications": [
    {{"name": "", "issuer": "", "date": ""}}
  ],
  "template": "classic"
}}

Empty arrays/strings are preferred over omitting fields.
""", target_user)


def analyze_resume_prompt(resume: dict, target_user: str | None = None) -> str:
    return _append_persona(f"""
You are a senior recruiter and resume reviewer. Evaluate the candidate's resume
below and produce an honest quality assessment.

CANDIDATE RESUME (JSON):
{_dump(resume)}

RULES:
1. Assess ONLY what is in the resume. Do not invent missing facts.
2. Suggestions are recommendations (e.g., "add a skills section", "quantify
   impact") — they must never assert facts about the candidate.

Return a JSON object with EXACTLY these keys:
{{
  "overall_score": X,
  "sections_present": ["..."],
  "missing_sections": ["..."],
  "ats_notes": ["..."],
  "impact_notes": ["..."],
  "strengths": ["..."],
  "suggestions": ["..."]
}}

overall_score is 0-100. Use empty arrays where applicable.
""", target_user)


def ats_check_prompt(resume: dict, job: dict | None = None, target_user: str | None = None) -> str:
    if job:
        target_part = f"\nTARGET JOB (JSON):\n{_dump(job)}"
    else:
        target_part = "\nTARGET JOB: (none provided — assess keyword completeness and formatting broadly)"
    return _append_persona(f"""
You are an ATS (Applicant Tracking System) audit expert. Run a triple-layer audit
of the candidate's resume below.

CANDIDATE RESUME (JSON):
{_dump(resume)}
{target_part}

AUTHENTICITY RULES (NON-NEGOTIABLE):
1. Base every assessment ONLY on what is in the resume. Do not invent facts.
2. Note when information is missing rather than assuming it exists.
3. Suggestions ("add a skills section", etc.) are recommendations, never
   assertions of candidate facts.

AUDIT LAYERS:
1. KEYWORD MATCH: compare resume terms against the job's required/preferred
   skills and responsibilities (skip detailed notes if no job is given).
2. STRUCTURE / HEADERS: check the resume has standard sections and headers
   (summary, experience, education, skills). List any that appear missing.
3. FORMATTING / PARSEABILITY: assess layout, bullets, tables, columns, fonts,
   and anything that could break ATS text extraction.
4. CONTACT HEADER INTEGRITY: confirm name, email, phone, and links are present.

Return a JSON object with EXACTLY these keys:
{{
  "overall_score": X,
  "keyword_notes": ["..."],
  "structure_notes": ["..."],
  "formatting_notes": ["..."],
  "missing_headers": ["..."],
  "parseability_notes": ["..."],
  "contact_present": true,
  "action_items": ["..."]
}}

overall_score is 0-100. Use empty arrays where applicable.
""", target_user)


def file_ats_prompt(resume_text: str, job: dict | None = None, target_user: str | None = None) -> str:
    if job:
        target_part = f"\nTARGET JOB (JSON):\n{_dump(job)}"
    else:
        target_part = "\nTARGET JOB: (none provided — assess keyword completeness and formatting broadly)"
    return _append_persona(f"""
You are an ATS (Applicant Tracking System) audit expert. Run a triple-layer audit
of the candidate's raw resume text below.

RAW RESUME TEXT:
{resume_text}
{target_part}

AUTHENTICITY RULES (NON-NEGOTIABLE):
1. Base every assessment ONLY on what is in the resume text. Do not invent facts.
2. Note when information is missing rather than assuming it exists.
3. Suggestions ("add a skills section", etc.) are recommendations, never
   assertions of candidate facts.

AUDIT LAYERS:
1. KEYWORD MATCH: compare resume terms against the job's required/preferred
   skills and responsibilities (skip detailed notes if no job is given).
2. STRUCTURE / HEADERS: check the resume has standard sections and headers
   (summary, experience, education, skills). List any that appear missing.
3. FORMATTING / PARSEABILITY: assess layout, bullets, tables, columns, fonts,
   and anything that could break ATS text extraction.
4. CONTACT HEADER INTEGRITY: confirm name, email, phone, and links are present.

Return a JSON object with EXACTLY these keys:
{{
  "overall_score": X,
  "keyword_notes": ["..."],
  "structure_notes": ["..."],
  "formatting_notes": ["..."],
  "missing_headers": ["..."],
  "parseability_notes": ["..."],
  "contact_present": true,
  "action_items": ["..."]
}}

overall_score is 0-100. Use empty arrays where applicable.
""", target_user)


def cover_letter_prompt(resume: dict, job: dict, target_user: str | None = None) -> str:
    return _append_persona(f"""
You are an expert cover letter writer. Write a 250-350 word cover letter for the
candidate applying to the job below.

AUTHENTICITY RULES (NON-NEGOTIABLE - NEVER BREAK):
1. Use ONLY facts present in the resume. Never invent achievements, skills,
   employers, dates, or metrics.
2. Reference the job posting's requirements only where the resume factually
   supports them.
3. Keep it 250-350 words, professional, and specific to this role.

CANDIDATE RESUME (JSON):
{_dump(resume)}

TARGET JOB (JSON):
{_dump(job)}

Return a JSON object with a single field "letter" containing the letter text.
""", target_user)


def interview_prep_prompt(resume: dict, job: dict, target_user: str | None = None) -> str:
    return _append_persona(f"""
You are an interview coach. Build a personalized interview-prep pack for the
candidate and the job below.

AUTHENTICITY RULES (NON-NEGOTIABLE):
1. Questions and talking points MUST be derived ONLY from the resume and job.
   Never invent experience, skills, or metrics.
2. Every talking point MUST trace to a specific resume line.
3. If the resume lacks a given area, suggest research rather than inventing facts.

CANDIDATE RESUME (JSON):
{_dump(resume)}

TARGET JOB (JSON):
{_dump(job)}

Return a JSON object with EXACTLY these keys:
{{
  "likely_questions": ["..."],
  "company_research": ["..."],
  "talking_points": ["..."],
  "questions_to_ask": ["..."]
}}

Use empty arrays where applicable.
""", target_user)