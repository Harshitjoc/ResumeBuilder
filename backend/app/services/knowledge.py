"""Application DNA helpers (Phase 1).

Pure, deterministic, no LLM. Derives the keyword ledger a resume variant sent,
computes cross-application gap patterns, and maps missing keywords to the
resume section where they would naturally belong.
"""
from typing import Any

_KNOWN_SKILLS = {
    "react", "python", "typescript", "javascript", "java", "go", "golang", "rust",
    "node", "nodejs", "express", "django", "flask", "fastapi", "graphql", "rest",
    "api", "docker", "kubernetes", "k8s", "terraform", "aws", "gcp", "azure",
    "postgres", "postgresql", "mysql", "mongodb", "redis", "sql", "nosql",
    "html", "css", "sass", "tailwind", "webpack", "vite", "jest", "cypress",
    "pytest", "selenium", "git", "ci/cd", "jenkins", "github actions", "linux",
    "machine learning", "deep learning", "nlp", "tensorflow", "pytorch",
    "pandas", "numpy", "spark", "kafka", "rabbitmq", "elasticsearch", "tableau",
    "agile", "scrum", "product management", "data analysis", "testing",
    "sdlc", "microservices", "serverless", "oop", "design patterns",
}


def _tokenize(text: Any) -> set[str]:
    if not text:
        return set()
    return {t for t in str(text).lower().split() }


def _resume_tokens(resume: Any) -> set[str]:
    tokens: set[str] = set()
    if not isinstance(resume, dict):
        return tokens
    def _consume(value: Any, depth: int = 0) -> None:
        if depth > 6:
            return
        if isinstance(value, str):
            for t in value.lower().replace("/", " ").replace("-", " ").split():
                tokens.add(t)
        elif isinstance(value, list):
            for item in value:
                _consume(item, depth + 1)
        elif isinstance(value, dict):
            for item in value.values():
                _consume(item, depth + 1)
    _consume(resume)
    return tokens


def _variant_customized_text(variant: Any) -> str:
    text = ""
    if not isinstance(variant, dict):
        return text
    for exp in (variant.get("experience") or []):
        if isinstance(exp, dict):
            text += " ".join(str(b) for b in (exp.get("bullets") or []) if b) + " "
    if isinstance(variant.get("professionalSummary"), str):
        text += variant["professionalSummary"] + " "
    return text.lower()


def _changes_introduced(item: Any, base_tokens: set[str], variant_tokens: set[str]) -> bool:
    """True when a keyword appears in the variant but did not exist in the base
    resume, i.e. it was introduced by a customization/verification change."""
    return item in variant_tokens and item not in base_tokens


def derive_keyword_ledger(
    variant: Any,
    base_resume: Any,
    analysis: Any,
    ats_check: Any,
    evidence: Any,
) -> list[dict[str, Any]]:
    """Build the per-application keyword coverage ledger.

    analysis = JobAnalysis as produced by /analyze-compatibility
    ats_check = AtsCheck as produced by /ats-check (may be None)
    """
    keywords: list[tuple[str, str]] = []

    def _collect(items: Any, source: str) -> None:
        for item in (items if isinstance(items, list) else []):
            if isinstance(item, str) and item.strip():
                keywords.append((item.strip(), source))

    if isinstance(analysis, dict):
        _collect(analysis.get("requiredSkills"), "required")
        _collect(analysis.get("preferredSkills"), "preferred")
        _collect(analysis.get("skillGaps"), "required")

    if isinstance(ats_check, dict):
        for note in (ats_check.get("keyword_notes") or []):
            if isinstance(note, str):
                for token in note.replace(",", " ").split():
                    if token.strip():
                        keywords.append((token.strip("•-* ").lower(), "ats"))
        for action in (ats_check.get("action_items") or []):
            if isinstance(action, str):
                for token in action.replace(",", " ").split():
                    if token.strip():
                        keywords.append((token.strip("•-* ").lower(), "ats"))

    variant_tokens = _resume_tokens(variant)
    base_tokens = _resume_tokens(base_resume)
    ledger: list[dict[str, Any]] = []
    seen: set[str] = set()

    for raw, source in keywords:
        key = raw.lower()
        if not key or key in seen:
            continue
        seen.add(key)
        in_resume = key in variant_tokens
        added = False
        if in_resume:
            added = _changes_introduced(key, base_tokens, variant_tokens)
        ledger.append({
            "keyword": raw,
            "inResume": in_resume,
            "addedByCustomization": added,
            "inVault": _evidence_supports(key, evidence),
            "source": source,
        })

    ledger.sort(key=lambda e: (not e["inResume"], e["source"], e["keyword"]))
    return ledger


def _evidence_supports(item: str, evidence: Any) -> bool:
    tokens = {t for t in item.lower().replace("/", " ").split()}
    if not tokens:
        return False
    return bool(_evidence_tokens_match(tokens, evidence))


def _evidence_tokens_match(tokens: set[str], evidence: Any) -> bool:
    for entry in (evidence if isinstance(evidence, list) else []):
        text = ""
        if isinstance(entry, dict):
            text = str(entry.get("text") or "")
        else:
            text = str(entry or "")
        etokens = {t for t in text.lower().replace("/", " ").split()}
        for t in tokens:
            if t in etokens:
                return True
    return False


def keyword_gaps(ledger: Any) -> list[str]:
    return sorted(
        {
            str(entry["keyword"])
            for entry in (ledger if isinstance(ledger, list) else [])
            if isinstance(entry, dict) and not entry.get("inResume")
        }
    )


def gap_patterns(applications: Any) -> list[dict[str, Any]]:
    """Across application records with a ledger, find keywords that reappear
    as gaps. Returns [{ keyword, missingCount, rejectedWithGap }] sorted by
    frequency."""
    tally: dict[str, int] = {}
    rejected_tally: dict[str, int] = {}
    for app in (applications if isinstance(applications, list) else []):
        if not isinstance(app, dict):
            continue
        for gap in keyword_gaps(app.get("keywordLedger")):
            tally[gap] = tally.get(gap, 0) + 1
            if str(app.get("status")) == "rejected":
                rejected_tally[gap] = rejected_tally.get(gap, 0) + 1
    patterns = [
        {"keyword": k, "missingCount": v, "rejectedWithGap": rejected_tally.get(k, 0)}
        for k, v in sorted(tally.items(), key=lambda kv: (-kv[1], kv[0]))
    ]
    return patterns


def keyword_section_hint(keyword: str) -> str:
    """Map a missing keyword to the resume section it belongs in, using a small
    deterministic hint table. 'skills' when the term looks like a real skill."""
    key = keyword.lower()
    if key in _KNOWN_SKILLS:
        return "skills"
    if any(m in key for m in ("degree", "bsc", "mba", "phd", "masters", "university", "college", "cert", "pmp", "aws certified")):
        return "education"
    if any(m in key for m in ("project", "portfolio", "repository", "github")):
        return "projects"
    if any(m in key for m in ("award", "honor", "language", "certification")) or len(key) > 40:
        return "certifications"
    return "skills"


def claim_index(
    resume: Any,
    evidence: Any,
    confirmed: Any = None,
    limit: int = 30,
) -> list[dict[str, Any]]:
    """Structured, deterministic index of every resume claim with its truth
    verdict for Phase 2 (interview truth layer + recruiter view).

    Each entry: { id, section, text, verdict, evidenceText, supported }.
    verdict ∈ { verified, confirmed, unverifiable, neutral }.
    """
    from app.services.extract import (
        claims_from_resume,
        evidence_supports,
        has_metric_claim,
    )

    claims = claims_from_resume(resume)
    confirmed_set = {str(c).strip().lower() for c in (confirmed or []) if c}
    index: list[dict[str, Any]] = []

    for i, claim in enumerate(claims[:limit]):
        text = claim["text"]
        support = evidence_supports(text, evidence)
        verdict = "neutral"
        if has_metric_claim(text):
            verdict = "verified" if support else "unverifiable"
        elif text.strip().lower() in confirmed_set:
            verdict = "confirmed"

        evidence_text = ""
        if support:
            evidence_text = str(
                support.get("text") if isinstance(support, dict) else support or ""
            ).strip()

        index.append({
            "id": f"claim-{i}",
            "section": claim["section"],
            "text": text,
            "verdict": verdict,
            "evidenceText": evidence_text,
            "supported": bool(support) or verdict in ("confirmed", "verified"),
        })

    return index