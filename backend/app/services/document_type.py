"""Deterministic, LLM-free document classification.

Detects whether raw text looks like a resume (vs a cover letter, a job
posting, or something else) so the app never silently force-fits a non-resume
into a resume shape or mints a meaningless ATS score. Pure and side-effect
free; no network, no keys, no quota.
"""
import re
from typing import Any

from app.services.extract import extract_contacts

_HEADER_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("summary", re.compile(r"\b(?:professional\s+)?summary\b", re.IGNORECASE)),
    ("objective", re.compile(r"\bobjective\b", re.IGNORECASE)),
    ("experience", re.compile(r"\b(?:work\s+)?experience\b", re.IGNORECASE)),
    ("education", re.compile(r"\beducation\b", re.IGNORECASE)),
    ("skills", re.compile(r"\bskills\b", re.IGNORECASE)),
    ("projects", re.compile(r"\bprojects?\b", re.IGNORECASE)),
    ("certifications", re.compile(r"\bcertifications?\b", re.IGNORECASE)),
]

_JOB_POSTING_MARKERS = [
    "job description",
    "responsibilities",
    "requirements",
    "qualifications",
    "about the role",
    "about this role",
    "position summary",
    "key responsibilities",
    "what you will do",
    "what you'll do",
    "we are looking for",
    "apply now",
    "apply by",
    "we offer",
    "benefits include",
    "employment type",
    "must have",
    "nice to have",
    "about the company",
    "about us",
    "location:",
    "salary:",
    "perks:",
    "who you are",
    "the opportunity",
]

_COVER_LETTER_MARKERS = [
    "dear hiring",
    "dear sir",
    "dear madam",
    "dear recruiter",
    "dear manager",
    "i am writing to apply",
    "i am applying for",
    "i would like to apply",
    "i would love to apply",
    "please find attached",
    "enclosed is my resume",
    "thank you for your time",
    "thank you for considering",
    "yours sincerely",
    "yours faithfully",
    "best regards",
    "i look forward to hearing from you",
]

_NON_RESUME_MARKERS = [
    "invoice",
    "receipt",
    "terms and conditions",
    "terms & conditions",
    "privacy policy",
    "user agreement",
    "subject:",
    "from:",
    "reply-to:",
    "delivered-to:",
    "shopping list",
    "ingredients",
    "recipe",
]

_ACADEMIC_MARKERS = [
    "abstract",
    "introduction",
    "methodology",
    "literature review",
    "results",
    "conclusion",
    "references",
    "citation",
    "doi:",
    "homework",
    "assignment",
    "syllabus",
    "lecture notes",
]

_DATE_RANGE_RE = re.compile(
    r"\b(?:19|20)\d{2}\s*[-–—]\s*(?:(?:19|20)\d{2}|present|current|ongoing)\b",
    re.IGNORECASE,
)

_BULLET_LINE_RE = re.compile(r"^\s*(?:[-*•]|\d+\.)\s")


def _count_markers(text: str, markers: list[str]) -> int:
    lower = text.lower()
    return sum(1 for m in markers if m.lower() in lower)


def _section_hits(text: str) -> list[str]:
    return [label for label, pattern in _HEADER_PATTERNS if pattern.search(text)]


def _date_range_count(text: str) -> int:
    return len(_DATE_RANGE_RE.findall(text))


def _bullet_density(text: str) -> float:
    lines = [l for l in text.splitlines() if l.strip()]
    if not lines:
        return 0.0
    bullets = sum(1 for l in lines if _BULLET_LINE_RE.match(l))
    return bullets / len(lines)


def classify_document(text: Any) -> dict[str, Any]:
    """Classify raw text as a resume, cover letter, job posting, or other.

    Contract:
      kind          -- 'resume' | 'cover-letter' | 'job-posting' | 'other'
      is_resume_like-- False only when there is strong evidence it is not a
                       resume; True ('unclear' / ambiguous) otherwise
      confidence    -- 0..100 heuristic confidence in the kind
      signals       -- human-readable cues used to decide
      reason        -- one-line summary for the UI
      score         -- raw heuristic score (positive toward resume)
    """
    text = str(text or "").strip()
    words = re.findall(r"\S+", text)

    if not text or len(words) < 20:
        return {
            "kind": "other",
            "is_resume_like": False,
            "confidence": 100,
            "signals": ["Text is empty or too short to be a resume."],
            "reason": "The document has almost no readable content.",
            "score": -100,
        }

    lower = text.lower()
    contact = extract_contacts(text)
    sections = _section_hits(text)
    date_ranges = _date_range_count(text)
    bullets = _bullet_density(text)

    job_hits = _count_markers(lower, _JOB_POSTING_MARKERS)
    cover_hits = _count_markers(lower, _COVER_LETTER_MARKERS)
    non_resume_hits = _count_markers(lower, _NON_RESUME_MARKERS)
    academic_hits = _count_markers(lower, _ACADEMIC_MARKERS)

    score = 0
    signals: list[str] = []

    if contact:
        score += 2
        signals.append(f"Contact details found ({', '.join(contact)}).")
    if sections:
        score += min(len(sections), 5)
        signals.append(f"Resume sections found: {', '.join(sections)}.")
    if date_ranges:
        score += 2 if date_ranges >= 1 else 0
        score += 1 if date_ranges >= 2 else 0
        signals.append(f"{date_ranges} date range(s) found (e.g. 2022 - Present).")
    if bullets >= 0.05:
        score += 1
        signals.append("Bullet-pointed content present.")

    if job_hits:
        score -= min(3, job_hits) * 2
        signals.append(f"{job_hits} job-posting phrase(s) found.")
    if cover_hits:
        score -= min(4, cover_hits)
        signals.append(f"{cover_hits} cover-letter phrase(s) found.")
    if non_resume_hits:
        score -= min(3, non_resume_hits) * 3
        signals.append(f"{non_resume_hits} non-resume marker(s) found.")
    if academic_hits:
        score -= min(2, academic_hits) * 3
        signals.append(f"{academic_hits} academic/document marker(s) found.")

    if job_hits >= 2 and score < 2:
        kind = "job-posting"
    elif cover_hits >= 2 and score < 3:
        kind = "cover-letter"
    elif non_resume_hits >= 2 or academic_hits >= 2:
        kind = "other"
    elif score >= 2:
        kind = "resume"
    else:
        kind = "other"

    is_resume_like = score >= 2
    confidence = min(100, max(0, 10 + abs(score) * 8))

    reasons = {
        "resume": "Looks like a resume.",
        "cover-letter": "Looks like a cover letter, not a resume.",
        "job-posting": "Looks like a job posting, not a resume.",
        "other": "Does not look like a resume.",
    }

    return {
        "kind": kind,
        "is_resume_like": is_resume_like,
        "confidence": confidence,
        "signals": signals,
        "reason": reasons[kind],
        "score": score,
    }


def assert_resume_like(text: Any) -> dict[str, Any]:
    """Return the classification, raising a structured 422 when the text is
    clearly not a resume. Deterministic; does not consume LLM quota."""
    result = classify_document(text)
    if not result["is_resume_like"]:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=422,
            detail={
                "code": "not_a_resume",
                "kind": result["kind"],
                "reason": result["reason"],
                "signals": result["signals"],
            },
        )
    return result