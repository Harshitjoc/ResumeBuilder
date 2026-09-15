"""Deterministic tests for the honesty engine (Phase 0).

These unit-test the pure helpers only — the LLM itself is not required, so the
suite runs without any provider.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.extract import (  # noqa: E402
    apply_hard_gate,
    evidence_supports,
    has_metric_claim,
    verifiable_claims,
)

SAMPLE_RESUME = {
    "professionalSummary": "Frontend engineer improving developer workflows.",
    "skills": ["Python", "React"],
    "experience": [
        {"jobTitle": "Engineer", "company": "Acme", "bullets": [
            "Reduced page load time by 40%.",
            "Built the internal design system.",
        ]}
    ],
    "projects": [{"name": "RB", "description": "Resume builder"}],
    "certifications": [{"name": "AWS Solutions"}],
}


def test_has_metric_claim_flags_quantitative():
    assert has_metric_claim("Improved conversion by 23%")
    assert has_metric_claim("Reduced latency to 40ms")
    assert has_metric_claim("Led a team of 12 engineers")
    assert not has_metric_claim("Built the internal design system")


def test_evidence_supports_substring_and_overlap():
    evidence = [
        {"id": "e1", "text": "Reduced page load time by 40%", "source": "document"},
        {"id": "e2", "text": "Designed the company design system", "source": "document"},
    ]
    match = evidence_supports("Cut page load time by 40%", evidence)
    assert match is not None and match["id"] == "e1"
    assert evidence_supports("Wrote unit tests", evidence) is None


def test_verifiable_claims_scoring():
    # No proof: the 40% bullet is unverifiable, the rest neutral.
    no_proof = verifiable_claims(SAMPLE_RESUME, [])
    assert no_proof["unverifiable"] == 1
    assert no_proof["verified"] == 0
    assert no_proof["honesty_score"] < 100
    assert no_proof["flagged"][0]["text"].startswith("Reduced page load time")

    # With matching proof the same bullet is verified -> score 100.
    with_proof = verifiable_claims(
        SAMPLE_RESUME,
        [{"id": "e1", "text": "Reduced page load time by 40%", "source": "document"}],
    )
    assert with_proof["verified"] == 1
    assert with_proof["honesty_score"] == 100

    # Empty resume -> no claims, score 100.
    assert verifiable_claims({}, [])["honesty_score"] == 100


def test_apply_hard_gate_blocks_unproven_metrics():
    evidence = []
    items = [
        {
            "section": "work_experience",
            "customized": "Improved conversion by 23%",
            "is_authentic": True,
            "confidence": "high",
        },
        {
            "section": "skills",
            "customized": "Moved React bullet higher",
            "is_authentic": True,
            "confidence": "high",
        },
    ]
    gated = apply_hard_gate(items, evidence)
    assert gated[0]["action"] == "blocked"
    assert gated[0]["is_authentic"] is False
    assert gated[0]["confidence"] == "low"
    assert "Evidence Vault" in gated[0]["reason"]
    assert "action" not in gated[1] or gated[1].get("action") != "blocked"


def test_apply_hard_gate_passes_when_proved():
    evidence = [{"id": "e1", "text": "Improved conversion by 23%", "source": "user"}]
    items = [
        {
            "section": "work_experience",
            "customized": "Boosted conversion by 23%",
            "is_authentic": True,
            "confidence": "high",
        }
    ]
    gated = apply_hard_gate(items, evidence)
    assert gated[0].get("action") != "blocked"