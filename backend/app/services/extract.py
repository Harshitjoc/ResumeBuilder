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


# ---------------------------------------------------------------------------
# Honesty engine: claim detection, evidence matching, and the hard gate.
# All pure / side-effect free.
# ---------------------------------------------------------------------------

_METRIC_WORDS = (
    r"led|improved|reduced|increased|grew|boosted|cut|drove|raised|delivered|"
    r"accelerated|optimized|streamlined|automated|scaled|built|designed|"
    r"handled|managed|resulted|achieved|saved|conversion|revenue|downtime|"
    r"latency|turnover|retention|throughput|efficiency|responses|signups"
)

# A claim sounds quantitative / demanding proof when it mixes a digit with a
# metric keyword or a percentage sign.
_METRIC_CLAIM_RE = re.compile(
    rf"(?i:(?:\d+(?:\.\d+)?\s*(?:%|x|×|hrs?|days?|weeks?|mtbf|ms|users?|"
    rf"customers?|clients?|stores?|revenue|orders|requests|downloads))|"
    rf"(?:(?:{_METRIC_WORDS})\b.{{0,60}}\d))"
)


def has_metric_claim(text: Any) -> bool:
    """Return True when text makes a quantitative/impact claim that needs proof.

    Examples: "Improved conversion by 23%", "Reduced latency to 40ms",
    "Led a team of 12 engineers".
    """
    if not text:
        return False
    return bool(_METRIC_CLAIM_RE.search(str(text)))


def _content_tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if len(t) > 2}


def _evidence_text(item: Any) -> str:
    if isinstance(item, dict):
        return str(item.get("text") or "").strip()
    return str(item or "").strip()


def evidence_supports(text: Any, evidence: Any) -> dict[str, Any] | None:
    """Return the first evidence item supporting a claim text, else None.

    Matched when one text contains the other, or content-token overlap >= 0.4.
    """
    claim = str(text or "").strip().lower()
    if not claim:
        return None
    claim_tokens = _content_tokens(claim)
    for item in _as_list(evidence):
        clean = _evidence_text(item).strip().lower()
        if not clean:
            continue
        if clean in claim or claim in clean:
            return item
        if not claim_tokens:
            continue
        ev_tokens = _content_tokens(clean)
        if not ev_tokens:
            continue
        overlap = len(claim_tokens & ev_tokens) / max(1, len(claim_tokens))
        if overlap >= 0.4:
            return item
    return None


def claims_from_resume(resume: Any) -> list[dict[str, str]]:
    """Flatten a resume into claim texts (per section) that a person would
    need to defend in an interview."""
    if not isinstance(resume, dict):
        return []
    claims: list[dict[str, str]] = []

    summary = str(resume.get("professionalSummary") or "").strip()
    if summary:
        claims.append({"section": "summary", "text": summary})

    for skill in _as_list(resume.get("skills")):
        for value in _as_list(skill):
            clean = str(value).strip()
            if clean:
                claims.append({"section": "skills", "text": clean})

    for exp in _as_list(resume.get("experience")):
        if not isinstance(exp, dict):
            continue
        for bullet in _as_list(exp.get("bullets")):
            clean = str(bullet or "").strip()
            if clean:
                claims.append({"section": "experience", "text": clean})

    for proj in _as_list(resume.get("projects")):
        if not isinstance(proj, dict):
            continue
        name = str(proj.get("name") or "").strip()
        description = str(proj.get("description") or "").strip()
        text = f"{name}: {description}".strip(": ")
        if text:
            claims.append({"section": "projects", "text": text})

    for cert in _as_list(resume.get("certifications")):
        if not isinstance(cert, dict):
            continue
        name = str(cert.get("name") or "").strip()
        if name:
            claims.append({"section": "certifications", "text": name})

    return claims


def verifiable_claims(
    resume: Any,
    evidence: Any,
    confirmed: list[str] | None = None,
) -> dict[str, Any]:
    """Produce the verifiability block for analysis endpoints.

    risky = quantitative claims; proved = risky claims with a matching evidence
    item or in the confirmed list. honesty_score = proved / risky.
    """
    confirmed = [str(c).strip().lower() for c in (confirmed or []) if c]
    claims = claims_from_resume(resume)
    total = len(claims)
    verified: list[dict[str, str]] = []
    unverifiable: list[dict[str, str]] = []
    neutral: list[dict[str, str]] = []

    for claim in claims:
        text = claim["text"]
        if has_metric_claim(text):
            support = evidence_supports(text, evidence)
            if support:
                verified.append(claim)
            else:
                unverifiable.append(
                    {**claim, "reason": "Quantitative claim without attached proof — add evidence or reframe."}
                )
        else:
            if text.lower() in confirmed:
                verified.append({**claim, "reason": "Confirmed by the user."})
            else:
                neutral.append(claim)

    risky = len(unverifiable) + len(verified)
    proved = len(verified)
    honesty_score = round(100 * proved / risky) if risky else 100

    return {
        "total": total,
        "verified": len(verified),
        "unverifiable": len(unverifiable),
        "neutral": len(neutral),
        "ai_drafted": 0,
        "honesty_score": honesty_score,
        "flagged": unverifiable[:20],
    }


def apply_hard_gate(customizations: Any, evidence: Any) -> list[dict[str, Any]]:
    """Enforce the evidence hard gate on generated customizations.

    Any item whose customized text makes an unsupported quantitative claim is
    forced to blocked state — the user must attach proof before approving.
    """
    result: list[dict[str, Any]] = []
    for item in _as_list(customizations):
        if not isinstance(item, dict):
            continue
        customized = str(item.get("customized") or "").strip()
        if customized and has_metric_claim(customized) and not evidence_supports(customized, evidence):
            item = dict(item)
            item["is_authentic"] = False
            item["confidence"] = "low"
            item["action"] = "blocked"
            item["reason"] = (
                str(item.get("reason") or "")
                + " This change adds a quantitative claim with no proof in your Evidence Vault — attach one or reframe it."
            ).strip()
        result.append(item)
    return result