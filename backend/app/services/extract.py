"""Deterministic, LLM-free helpers for resume parsing enrichment.

These functions fill gaps left by the LLM parse using only what is literally
present in the document text, and they attach source-of-truth metadata
(evidence items + contact confidence) so the frontend can verify authenticity.
All functions here are pure and side-effect free.
"""
import re
import uuid
from typing import Any

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
PHONE_RE = re.compile(
    r"(?<!\d)(?:\+?\d{1,2}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)"
)
LINKEDIN_RE = re.compile(
    r"(?:https?://)?(?:www\.)?linkedin\.com/in/[\w-]+", re.IGNORECASE
)
GITHUB_RE = re.compile(r"(?:https?://)?(?:www\.)?github\.com/[\w-]+", re.IGNORECASE)
WEBSITE_RE = re.compile(r"https?://[^\s]+", re.IGNORECASE)

CONTACT_KEYS = ("fullName", "email", "phone", "linkedin", "github", "website")

_EXTRACTABLE_CONTACT_KEYS = ("email", "phone", "linkedin", "github", "website")

_TRAILING_URL_PUNCT = ".,;:!?)"


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _clean_url(value: str) -> str:
    value = value.strip()
    if value.endswith(")"):
        open_count = value.count("(")
        close_count = value.count(")")
        if close_count > open_count:
            value = value[:-1]
    value = value.rstrip(_TRAILING_URL_PUNCT)
    return value


def extract_contacts(text: str) -> dict[str, str]:
    """Find contact details in a raw resume text using regexes only.

    Returns a dict keyed by 'email' | 'phone' | 'linkedin' | 'github' | 'website'.
    A key is only present if a match was found in the text. The website entry
    excludes URLs that are already captured as linkedin/github.
    """
    if not text:
        return {}
    found: dict[str, str] = {}

    email = EMAIL_RE.search(text)
    if email:
        found["email"] = email.group().strip()

    phone = PHONE_RE.search(text)
    if phone:
        found["phone"] = phone.group().strip().rstrip(_TRAILING_URL_PUNCT)

    linkedin = LINKEDIN_RE.search(text)
    if linkedin:
        found["linkedin"] = _clean_url(linkedin.group())

    github = GITHUB_RE.search(text)
    if github:
        found["github"] = _clean_url(github.group())

    for match in WEBSITE_RE.finditer(text):
        url = _clean_url(match.group())
        if not url:
            continue
        bare = re.sub(r"^https?://(www\.)?", "", url).lower()
        if bare.startswith("linkedin.com") or bare.startswith("github.com"):
            continue
        found["website"] = url
        break

    return found


def build_contact_confidence(
    contact: Any, extracted: dict[str, str]
) -> dict[str, float]:
    """Confidence per contact key.

    1.0 when present in both the parsed contact and the regex pass, 0.7 when
    present only from the LLM parse, 0.0 when empty.
    """
    if not isinstance(contact, dict):
        contact = {}
    result: dict[str, float] = {}
    for key in CONTACT_KEYS:
        value = str(contact.get(key) or "").strip()
        if value:
            result[key] = 1.0 if extracted.get(key) else 0.7
        else:
            result[key] = 0.0
    return result


def _fill_contacts(contact: dict[str, Any], extracted: dict[str, str]) -> dict[str, Any]:
    """Fill empty contact fields from the deterministic regex pass."""
    filled = dict(contact or {})
    for key in _EXTRACTABLE_CONTACT_KEYS:
        if not str(filled.get(key) or "").strip() and extracted.get(key):
            filled[key] = extracted[key]
    return filled


def build_evidence(parsed: Any) -> list[dict[str, Any]]:
    """Turn a parsed resume into a flat list of verifiable evidence items."""
    if not isinstance(parsed, dict):
        parsed = {}
    evidence: list[dict[str, Any]] = []

    def _add(category: str, text: Any, confidence: str) -> None:
        clean = str(text or "").strip()
        if not clean:
            return
        evidence.append(
            {
                "id": uuid.uuid4().hex,
                "category": category,
                "text": clean,
                "confidence": confidence,
                "source": "document",
            }
        )

    skills = _as_list(parsed.get("skills"))
    for skill in skills:
        if isinstance(skill, list):
            for s in skill:
                _add("skill", s, "high")
        elif isinstance(skill, str) and "," in skill:
            for s in skill.split(","):
                _add("skill", s, "high")
        else:
            _add("skill", skill, "high")

    for item in _as_list(parsed.get("education")):
        if isinstance(item, dict):
            label = " ".join(
                str(item.get(k) or "") for k in ("degree", "school")
            ).strip()
            _add("education", label or item.get("degree"), "high")
        else:
            _add("education", item, "high")

    for item in _as_list(parsed.get("certifications")):
        if isinstance(item, dict):
            _add("certification", item.get("name") or item.get("issuer"), "high")
        else:
            _add("certification", item, "high")

    for item in _as_list(parsed.get("projects")):
        if isinstance(item, dict):
            _add("project", item.get("name") or item.get("description"), "medium")
        else:
            _add("project", item, "medium")

    for item in _as_list(parsed.get("experience")):
        bullets = _as_list(item.get("bullets")) if isinstance(item, dict) else []
        for bullet in bullets:
            if isinstance(bullet, dict):
                text = " ".join(
                    str(bullet.get(k) or "")
                    for k in ("jobTitle", "company", "summary")
                ).strip()
                _add("achievement", text, "medium")
                continue
            text = str(bullet or "").strip()
            if not text:
                continue
            if re.search(r"\d|%", text):
                _add("metric", text, "medium")
            else:
                _add("achievement", text, "medium")

    return evidence