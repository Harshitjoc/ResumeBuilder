"""Tests for the Phase 1 application-DNA helpers (backend)."""
from app.services.knowledge import (
    derive_keyword_ledger,
    keyword_gaps,
    gap_patterns,
    keyword_section_hint,
)

BASE = {
    "professionalSummary": "Frontend engineer. React specialists.",
    "skills": ["react", "typescript"],
    "experience": [
        {
            "role": "FE dev",
            "company": "Co",
            "bullets": ["Built dashboards in React"],
        }
    ],
}

VARIANT = {
    "professionalSummary": "Frontend engineer. React specialists.",
    "skills": ["react", "typescript", "graphql"],
    "experience": [
        {
            "role": "FE dev",
            "company": "Co",
            "bullets": [
                "Built dashboards in React",
                "Shipped a GraphQL gateway for 2k users",
            ],
        }
    ],
}

ANALYSIS = {
    "requiredSkills": ["react", "graphql", "kubernetes"],
    "preferredSkills": ["jest"],
    "skillGaps": ["kubernetes"],
}

ATS = {
    "keyword_notes": ["Missing: docker (ATS)  ", "route /api seen"],
    "action_items": ["Add a contact header"],
}


def _f(text=""):
    return [{"id": "e1", "text": text}]


def test_ledger_sources_and_flags():
    ledger = derive_keyword_ledger(VARIANT, BASE, ANALYSIS, None, _f("Led Kubernetes"))
    by = {e["keyword"]: e for e in ledger}
    assert by["react"]["inResume"] is True
    assert by["react"]["inVault"] is False
    assert by["graphql"]["inResume"] is True
    assert by["graphql"]["addedByCustomization"] is True
    assert by["graphql"]["source"] == "required"
    assert by["kubernetes"]["inResume"] is False
    assert by["kubernetes"]["inVault"] is True  # evidence mentions kubernetes
    assert by["jest"]["source"] == "preferred"


def test_ledger_skips_duplicates():
    ledger = derive_keyword_ledger(VARIANT, BASE, ANALYSIS, None, [])
    keys = [e["keyword"] for e in ledger]
    assert keys.count("kubernetes") == 1  # deduped across required + skillGaps


def test_ledger_derives_ats_keywords():
    ledger = derive_keyword_ledger(VARIANT, BASE, {"requiredSkills": [], "preferredSkills": [], "skillGaps": []}, ATS, [])
    ats_hits = [e for e in ledger if e["source"] == "ats"]
    assert any(e["keyword"] == "docker" for e in ats_hits)


def test_keyword_gaps_and_patterns():
    a = derive_keyword_ledger(VARIANT, BASE, ANALYSIS, None, [])
    assert "kubernetes" in keyword_gaps(a)

    apps = [
        {"status": "rejected", "keywordLedger": derive_keyword_ledger(VARIANT, BASE, ANALYSIS, None, [])},
        {"status": "rejected", "keywordLedger": derive_keyword_ledger(VARIANT, BASE, ANALYSIS, None, [])},
        {"status": "applied", "keywordLedger": []},
        {"status": "offer", "keywordLedger": [{"keyword": "react", "inResume": True}]},
    ]
    patterns = gap_patterns(apps)
    ku = next(p for p in patterns if p["keyword"] == "kubernetes")
    assert ku["missingCount"] == 2
    assert ku["rejectedWithGap"] == 2


def test_keyword_section_hint():
    assert keyword_section_hint("kubernetes") == "skills"
    assert keyword_section_hint("MBA") == "education"
    assert keyword_section_hint("project portfolio") == "projects"


def test_claim_index_verdicts():
    from app.services.knowledge import claim_index

    resume = {
        "professionalSummary": "Analytical engineer.",
        "skills": ["Python", "Algorithms"],
        "experience": [
            {"role": "Engineer", "company": "Co", "bullets": ["Reduced latency by 40%."]}
        ],
        "projects": [{"name": "P", "description": "A project"}],
    }
    evidence = [{"id": "e1", "text": "Reduced API latency by 40% at Co"}]
    index = claim_index(resume, evidence, confirmed=["Analytical engineer."])
    by_section = {c["section"]: c for c in index}

    # Summary claim is confirmed by the user (qualitative, in confirmed list).
    assert by_section["summary"]["verdict"] == "confirmed"
    assert by_section["summary"]["supported"] is True

    # Metric claim with matching evidence -> verified + proof attached.
    assert by_section["experience"]["verdict"] == "verified"
    assert bool(by_section["experience"]["evidenceText"])

    # Plain skill claim defaults to neutral.
    assert by_section["skills"]["verdict"] == "neutral"


def test_claim_index_unverifiable_metric_without_evidence():
    from app.services.knowledge import claim_index

    resume = {
        "experience": [
            {"role": "Engineer", "bullets": ["Drove revenue up 30%."]}
        ],
    }
    index = claim_index(resume, [], confirmed=[])
    assert index[0]["verdict"] == "unverifiable"
    assert index[0]["supported"] is False


def test_claim_index_never_proof_backs_ai_drafted():
    from app.services.knowledge import claim_index

    resume = {"professionalSummary": "Built cool things."}
    # An ai-drafted verdict is not part of confirmed claims; no evidence exists.
    index = claim_index(resume, [], confirmed=[])
    assert index[0]["verdict"] != "verified"
    assert index[0]["supported"] is False