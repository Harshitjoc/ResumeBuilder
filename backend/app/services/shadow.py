"""ATS shadow-parse (Phase 2).

A deterministic, offline, no-LLM audit of a structured resume that returns the
exact same ``check`` shape as the LLM triple-layer audit. Heuristic and labeled
as such; never presented as the deep Pro check.
"""
import re
from typing import Any

from app.services.knowledge import _resume_tokens, derive_keyword_ledger

REQUIRED_SECTIONS = {
    "summary": "Summary or objective section absent",
    "experience": "Work experience section absent",
    "education": "Education section absent",
    "skills": "Skills section absent",
}


def _as_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
    return out


def _extract_skills(job: Any, bucket: str) -> list[str]:
    """Read a job's required/preferred skills regardless of shape
    (JobAnalysis uses requiredSkills; parsed jobs use required_skills)."""
    if not isinstance(job, dict):
        return []
    for key in (bucket + "Skills", bucket + "_skills"):
        skills = _as_str_list(job.get(key))
        if skills:
            return skills
    return []


def _contact_state(resume: Any) -> dict[str, Any]:
    contact = resume.get("contact") if isinstance(resume, dict) else None
    contact = contact if isinstance(contact, dict) else {}
    present = bool(
        str(contact.get("email") or "").strip()
        or str(contact.get("phone") or "").strip()
    )
    link = bool(
        str(contact.get("linkedin") or "").strip()
        or str(contact.get("github") or "").strip()
        or str(contact.get("website") or "").strip()
    )
    return {"present": present, "link": link}


def shadow_check(resume: Any, job: Any = None) -> dict[str, Any]:
    """Deterministic ATS audit of a structured ResumeData object.

    Every delta traces to an observable property. Score floor 0 / ceiling 100.
    """
    r = resume if isinstance(resume, dict) else {}
    score = 100

    keyword_notes: list[str] = []
    structure_notes: list[str] = []
    formatting_notes: list[str] = []
    parseability_notes: list[str] = []
    missing_headers: list[str] = []
    action_items: list[str] = []

    # -- Contact header ------------------------------------------------------
    contact_state = _contact_state(r)
    if not contact_state["present"]:
        score -= 15
        action_items.append("Add an email and phone number to the contact header.")
        parseability_notes.append(
            "No email or phone in the contact header — many ATS require one."
        )
    elif not contact_state["link"]:
        score -= 2
        parseability_notes.append(
            "No LinkedIn/GitHub link in the header — consider adding one."
        )

    # -- Standard sections ---------------------------------------------------
    sections = {
        "summary": bool(str(r.get("professionalSummary") or "").strip()),
        "experience": bool(r.get("experience")),
        "education": bool(r.get("education")),
        "skills": bool(r.get("skills")),
    }
    for name, present in sections.items():
        if not present:
            missing_headers.append(name)
            score -= 5
            structure_notes.append(REQUIRED_SECTIONS[name])

    # -- Experience depth + quantification -----------------------------------
    experience = r.get("experience") if isinstance(r, dict) else None
    bullets: list[str] = []
    for entry in experience if isinstance(experience, list) else []:
        if not isinstance(entry, dict):
            continue
        for bullet in (entry.get("bullets") or []):
            text = str(bullet or "").strip()
            if text:
                bullets.append(text)

    if not experience:
        score -= 8
        if "experience" not in missing_headers:
            structure_notes.append(
                "No experience entries — include at least one role or project."
            )
    elif bullets:
        unquantified = [
            b for b in bullets if not re.search(r"\d", b) and len(b) >= 20
        ]
        if len(unquantified) / len(bullets) >= 0.4:
            score -= 6
            formatting_notes.append(
                "40%+ of experience bullets carry no numbers — quantify impact where truthful."
            )
            action_items.append(
                "Quantify 2-3 experience bullets with real numbers (never invented)."
            )
        if any(b.isupper() and len(b) > 14 for b in bullets):
            score -= 3
            formatting_notes.append(
                "ALL-CAPS bullet text may confuse text-extraction parsers."
            )

    # -- Summary / skills ----------------------------------------------------
    summary = str(r.get("professionalSummary") or "").strip()
    if summary and len(summary) < 30:
        score -= 4
        structure_notes.append("Summary is very short (< 30 characters).")

    # -- Keyword match against the job ---------------------------------------
    ledger: list[dict[str, Any]] = []
    if job:
        required = _extract_skills(job, "required")
        preferred = _extract_skills(job, "preferred")
        tokens = _resume_tokens(r)

        gaps = [kw for kw in required if kw.lower() not in tokens]
        score -= min(20, 2 * len(gaps))
        for gap in gaps[:6]:
            keyword_notes.append(f"Missing required term: {gap}")
            action_items.append(
                f"Name {gap} only where the resume truthfully supports it — attach evidence first."
            )

        if preferred:
            covered = sum(1 for kw in preferred if kw.lower() in tokens)
            if covered < len(preferred):
                keyword_notes.append(
                    f"Preferred skills partially covered ({covered}/{len(preferred)})."
                )

        if gaps or preferred:
            synthetic_analysis = {
                "requiredSkills": required,
                "preferredSkills": preferred,
            }
            ledger = derive_keyword_ledger(r, r, synthetic_analysis, None, [])

    score = max(0, min(100, score))

    return {
        "overall_score": score,
        "keyword_notes": keyword_notes,
        "structure_notes": structure_notes,
        "formatting_notes": formatting_notes,
        "missing_headers": missing_headers,
        "parseability_notes": parseability_notes,
        "contact_present": contact_state["present"],
        "action_items": action_items,
        "keywordLedger": ledger,
    }