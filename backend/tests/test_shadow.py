"""Tests for the deterministic ATS shadow-parse (Phase 2).

Pure, offline, no-LLM. The endpoint is Free and must never be quota-metered.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services.shadow import shadow_check  # noqa: E402

client = TestClient(app)

GOOD_RESUME = {
    "contact": {"fullName": "Aarav Sharma", "email": "a@b.com", "phone": "+1 555", "linkedin": "in/a"},
    "professionalSummary": "Full-stack engineer with 6 years building React and Node systems.",
    "skills": ["react", "typescript", "node", "graphql", "docker"],
    "experience": [
        {
            "jobTitle": "Senior Engineer",
            "company": "Acme",
            "startDate": "2021-01",
            "endDate": "2024-06",
            "bullets": [
                "Cut API latency by 40% with caching.",
                "Led a team of 8 engineers.",
                "Migrated 120k users to a new billing platform.",
            ],
        }
    ],
    "education": [{"degree": "B.Tech", "school": "NIT", "endDate": "2016"}],
    "projects": [],
    "certifications": [],
    "notes": "",
    "template": "modern",
}

STRIPPED_RESUME = {
    "contact": {"fullName": "No Contact"},
    "professionalSummary": "",
    "skills": [],
    "experience": [],
    "education": [],
    "projects": [],
    "certifications": [],
    "notes": "",
    "template": "modern",
}


def test_shadow_contact_and_sections_penalized():
    check = shadow_check(STRIPPED_RESUME)
    assert check["overall_score"] < 60
    assert check["contact_present"] is False
    assert "summary" in check["missing_headers"]
    assert "experience" in check["missing_headers"]
    assert "skills" in check["missing_headers"]
    assert any("email" in a.lower() for a in check["action_items"])


def test_shadow_good_resume_scores_high():
    check = shadow_check(GOOD_RESUME)
    assert check["overall_score"] >= 75
    assert check["contact_present"] is True
    assert check["missing_headers"] == []
    assert check["keyword_notes"] == []


def test_shadow_unquantified_bullets_flagged():
    resume = {
        **STRIPPED_RESUME,
        "contact": {"email": "a@b.com", "phone": "+1 555"},
        "experience": [
            {
                "jobTitle": "Engineer",
                "company": "Acme",
                "bullets": [
                    "Worked on a project helping the team ship features faster.",
                    "Collaborated with design and product stakeholders every week.",
                    "Handled multiple responsibilities across the platform team.",
                ],
            }
        ],
        "education": [{"degree": "BSc", "school": "X", "endDate": "2015"}],
        "professionalSummary": "Engineer building web products.",
    }
    check = shadow_check(resume)
    assert any("no numbers" in n.lower() for n in check["formatting_notes"])
    assert check["overall_score"] < 90


def test_shadow_keyword_ledger_with_job():
    check = shadow_check(
        GOOD_RESUME,
        {"requiredSkills": ["kubernetes", "react"], "preferredSkills": ["graphql"]},
    )
    check["keywordLedger"]  # ledger present
    assert any("kubernetes" in n for n in check["keyword_notes"])
    assert check["overall_score"] < 100
    ledger = check["keywordLedger"]
    kubernetes = next(e for e in ledger if e["keyword"] == "kubernetes")
    assert kubernetes["inResume"] is False
    react = next(e for e in ledger if e["keyword"] == "react")
    assert react["inResume"] is True


def test_shadow_score_clamped():
    check = shadow_check(STRIPPED_RESUME, {"requiredSkills": ["x"] * 12})
    assert 0 <= check["overall_score"] <= 100


def test_shadow_endpoint_free_and_not_quota_metered():
    # A free client key must NOT be 429'd on a deterministic, no-LLM endpoint.
    resp = client.post(
        "/api/ats/shadow",
        json={"resume": GOOD_RESUME, "job": {"requiredSkills": ["kubernetes"]}},
        headers={"X-Client-Key": "free-anon-123"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["heuristic"] is True
    assert body["check"]["overall_score"] > 0
    assert any(e["keyword"] == "kubernetes" for e in body["keywordLedger"])


def test_shadow_endpoint_shape_matches_llm_ats():
    resp = client.post(
        "/api/ats/shadow",
        json={"resume": GOOD_RESUME},
    )
    assert resp.status_code == 200, resp.text
    check = resp.json()["check"]
    for key in (
        "overall_score",
        "keyword_notes",
        "structure_notes",
        "formatting_notes",
        "missing_headers",
        "parseability_notes",
        "contact_present",
        "action_items",
    ):
        assert key in check, key