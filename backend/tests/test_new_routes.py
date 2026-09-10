"""Tests for the new persona-aware routes and deterministic parse enrichment.

All tests in this file run WITHOUT Ollama:
- bad-provider (400) paths for the three new endpoints,
- deterministic contact extraction / contact-confidence / evidence builders
  imported directly from app.services.extract.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services.extract import (  # noqa: E402
    build_contact_confidence,
    build_evidence,
    extract_contacts,
)

client = TestClient(app)

SAMPLE_RESUME = {
    "fullName": "Ada Lovelace",
    "contact": {"email": "ada@example.com", "phone": "+1 555 0100"},
    "summary": "Analytical engineer focused on computing systems.",
    "skills": ["Python", "Algorithms", "Analytics"],
    "workExperience": [
        {
            "company": "Analytical Engines",
            "title": "Engineer",
            "startDate": "2019-01",
            "endDate": "2022-06",
            "bullets": ["Built analytical models.", "Wrote algorithms in Python."],
        }
    ],
    "education": [
        {"school": "University of London", "degree": "BSc", "startDate": "2015-09", "endDate": "2018-06"}
    ],
    "projects": [],
    "certifications": [],
}

SAMPLE_JOB = {
    "job_title": "Data Analyst",
    "company": "Acme Analytics",
    "required_skills": ["Python", "SQL"],
    "preferred_skills": ["Machine Learning"],
    "key_responsibilities": ["Analyze datasets", "Build dashboards"],
}


# --------------------------------------------------------------------------
# Bad provider -> 400 for the three new endpoints
# --------------------------------------------------------------------------
def test_ats_check_bad_provider():
    resp = client.post(
        "/api/llm/ats-check",
        json={"resume": SAMPLE_RESUME, "job": SAMPLE_JOB, "apiKeys": {"provider": "bogus"}},
    )
    assert resp.status_code == 400, resp.text


def test_cover_letter_bad_provider():
    resp = client.post(
        "/api/llm/generate-cover-letter",
        json={"resume": SAMPLE_RESUME, "job": SAMPLE_JOB, "apiKeys": {"provider": "bogus"}},
    )
    assert resp.status_code == 400, resp.text


def test_interview_prep_bad_provider():
    resp = client.post(
        "/api/llm/generate-interview-prep",
        json={"resume": SAMPLE_RESUME, "job": SAMPLE_JOB, "apiKeys": {"provider": "bogus"}},
    )
    assert resp.status_code == 400, resp.text


# Invalid targetUser must be ignored (treated as None), never a 422/500.
def test_ats_check_invalid_target_user_ignored():
    resp = client.post(
        "/api/llm/ats-check",
        json={
            "resume": SAMPLE_RESUME,
            "job": None,
            "apiKeys": {"provider": "bogus"},
            "targetUser": "not-a-persona",
        },
    )
    assert resp.status_code == 400, resp.text


def test_cover_letter_accepts_each_valid_persona():
    for persona in ("recent-grad", "working-professional", "career-switcher"):
        resp = client.post(
            "/api/llm/generate-cover-letter",
            json={
                "resume": SAMPLE_RESUME,
                "job": SAMPLE_JOB,
                "apiKeys": {"provider": "bogus"},
                "targetUser": persona,
            },
        )
        assert resp.status_code == 400, resp.text  # bad provider still wins


# --------------------------------------------------------------------------
# Deterministic contact extraction + fill + confidence
# --------------------------------------------------------------------------
def test_extract_contacts_finds_email_phone_linkedin():
    text = (
        "John A. Sample\n"
        "john.sample@email.com | (555) 010-1234 | https://www.linkedin.com/in/johnsample\n"
        "info@company.co.uk also present later"
    )
    contacts = extract_contacts(text)
    assert contacts["email"] == "john.sample@email.com", contacts
    assert contacts["phone"] == "(555) 010-1234", contacts
    assert "linkedin.com/in/johnsample" in contacts["linkedin"], contacts


def test_extract_website_excludes_linkedin_and_github():
    text = "github.com/ada - portfolio at https://portfolio.dev/ada plus linkedin.com/in/ada"
    contacts = extract_contacts(text)
    assert contacts["github"] == "github.com/ada", contacts
    assert contacts["website"] == "https://portfolio.dev/ada", contacts
    assert "linkedin.com/in/ada" in contacts["linkedin"], contacts
    assert contacts["website"] != contacts["linkedin"], contacts


def test_extract_phone_variants():
    for variant in ("+1 555 010 1234", "555-010-1234", "555.010.1234"):
        got = extract_contacts("Call me at " + variant)
        assert got.get("phone") == variant, (variant, got)


def test_contact_confidence_after_fill():
    text = "john.sample@email.com | (555) 010-1234 | linkedin.com/in/johnsample"
    extracted = extract_contacts(text)
    assert extracted.get("email") and extracted.get("phone") and extracted.get("linkedin")

    parsed_contact = {
        "fullName": "John Sample",
        "email": "",
        "phone": "",
        "linkedin": "",
        "github": "",
        "website": "",
    }
    for key, value in extracted.items():
        parsed_contact[key] = value

    confidence = build_contact_confidence(parsed_contact, extracted)
    assert confidence["email"] == 1.0, confidence
    assert confidence["phone"] == 1.0, confidence
    assert confidence["linkedin"] == 1.0, confidence
    assert confidence["fullName"] == 0.7, confidence  # LLM-only (no regex for name)
    assert confidence["github"] == 0.0, confidence
    assert confidence["website"] == 0.0, confidence


def test_contact_confidence_empty_all_zero():
    confidence = build_contact_confidence({}, {})
    assert set(confidence) == {"fullName", "email", "phone", "linkedin", "github", "website"}
    assert all(value == 0.0 for value in confidence.values()), confidence


# --------------------------------------------------------------------------
# Evidence builder
# --------------------------------------------------------------------------
def test_evidence_builder_categories_and_ids():
    parsed = {
        "skills": ["Python", "SQL"],
        "education": [{"degree": "BSc", "school": "State University", "endDate": "2018-06"}],
        "certifications": [{"name": "AWS Certified", "issuer": "Amazon"}],
        "projects": [{"name": "Resume Builder", "description": "web app"}],
        "experience": [
            {
                "jobTitle": "Developer",
                "company": "Data Corp",
                "bullets": [
                    "Built ETL pipelines handling 2M rows daily.",
                    "Migrated services to FastAPI.",
                ],
            }
        ],
    }
    evidence = build_evidence(parsed)
    assert evidence, evidence
    categories = {item["category"] for item in evidence}
    assert {"skill", "education", "certification", "project", "metric", "achievement"} <= categories, categories
    assert all(item["source"] == "document" for item in evidence)
    assert all(item["confidence"] in ("high", "medium", "low") for item in evidence)
    assert all(len(item["id"]) == 32 for item in evidence)  # uuid4 hex

    skills = [item for item in evidence if item["category"] == "skill"]
    assert {item["text"] for item in skills} == {"Python", "SQL"}, skills
    assert all(item["confidence"] == "high" for item in skills)

    metrics = [item for item in evidence if item["category"] == "metric"]
    assert metrics and "2M" in metrics[0]["text"], metrics

    achievements = [item for item in evidence if item["category"] == "achievement"]
    assert any("FastAPI" in item["text"] for item in achievements), achievements


def test_evidence_builder_comma_skills_and_garbage_safe():
    parsed = {"skills": "Python, SQL, AWS", "experience": "not a list", "projects": []}
    evidence = build_evidence(parsed)
    skill_texts = {item["text"] for item in evidence if item["category"] == "skill"}
    assert {"Python", "SQL", "AWS"} <= skill_texts, skill_texts


def test_evidence_builder_empty_parsed():
    assert build_evidence({}) == []
    assert build_evidence(None) == []


if __name__ == "__main__":
    failures = 0
    tests = [
        test_ats_check_bad_provider,
        test_cover_letter_bad_provider,
        test_interview_prep_bad_provider,
        test_ats_check_invalid_target_user_ignored,
        test_cover_letter_accepts_each_valid_persona,
        test_extract_contacts_finds_email_phone_linkedin,
        test_extract_website_excludes_linkedin_and_github,
        test_extract_phone_variants,
        test_contact_confidence_after_fill,
        test_contact_confidence_empty_all_zero,
        test_evidence_builder_categories_and_ids,
        test_evidence_builder_comma_skills_and_garbage_safe,
        test_evidence_builder_empty_parsed,
    ]
    for t in tests:
        print(f"== {t.__name__}")
        try:
            t()
            print("   PASS")
        except AssertionError as e:
            failures += 1
            print(f"   FAIL: {e}")
        except Exception as e:
            failures += 1
            print(f"   ERROR: {type(e).__name__}: {e}")

    print(f"\n{'ALL PASSED' if failures == 0 else f'{failures} FAILURE(S)'}")
    sys.exit(1 if failures else 0)