"""Tests for the deterministic non-resume document classifier (document_type.py).

Pure, offline, no-LLM. Covers classify_document/assert_resume_like and the
gate wiring on /api/llm/parse-resume + /api/ats/file + /api/upload/extract.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services.document_type import classify_document  # noqa: E402
from app.services import entitlements  # noqa: E402

client = TestClient(app)
PRO_CLIENT = "test-ats-pro"

RESUME_TEXT = """Aarav Sharma
a@b.com | +1 555 123 4567 | linkedin.com/in/aarav

PROFESSIONAL SUMMARY
Full-stack engineer with 6 years building React and Node systems.

EXPERIENCE
Senior Engineer, Acme Corp (Jan 2021 - Jun 2024)
- Cut API latency by 40% with caching.
- Led a team of 8 engineers.
- Migrated 120k users to a new billing platform.

EDUCATION
B.Tech Computer Science, NIT (2016)

SKILLS
React, TypeScript, Node, GraphQL, Docker
"""

JOB_POSTING_TEXT = """Senior Frontend Engineer - Acme Corp
Location: Bangalore | Salary: 25-35 LPA | Apply by: Dec 2026

About us: Acme Corp builds payment infrastructure for 10k merchants.

What you will do:
- Build high-traffic React applications.
- Own performance budgets for the checkout flow.

What we are looking for:
- 5+ years of React experience.
- Strong TypeScript and Node skills.

Perks: health insurance, gym, flexible hours.
Equal opportunity employer.
"""

COVER_LETTER_TEXT = """Dear Hiring Manager,

I am excited to apply for the Senior Frontend Engineer role at Acme Corp.
With 6 years of React experience, I believe I am a great fit for your team.

Yours sincerely,
Aarav Sharma
"""

INVOICE_TEXT = """INVOICE #1042
Acme Corp
Date: 2026-09-01
Item: Consulting services - Qty 4 - Rate 200/hr - 800
Total due: 800 USD
"""


def test_classify_resume():
    result = classify_document(RESUME_TEXT)
    assert result["kind"] == "resume"
    assert result["is_resume_like"] is True
    assert result["score"] >= 2
    assert result["signals"]


def test_classify_job_posting():
    result = classify_document(JOB_POSTING_TEXT)
    assert result["kind"] == "job-posting"
    assert result["is_resume_like"] is False


def test_classify_cover_letter():
    result = classify_document(COVER_LETTER_TEXT)
    assert result["kind"] == "cover-letter"
    assert result["is_resume_like"] is False


def test_classify_invoice_is_other():
    result = classify_document(INVOICE_TEXT)
    assert result["kind"] == "other"
    assert result["is_resume_like"] is False


def test_classify_blank():
    result = classify_document("")
    assert result["is_resume_like"] is False
    assert result["confidence"] == 100


def test_classify_short_text():
    result = classify_document("Hello world, this is short text with no sections")
    assert result["is_resume_like"] is False


def test_classify_single_section_only():
    text = "SKILLS\nReact, TypeScript\n"
    result = classify_document(text)
    assert result["is_resume_like"] is False


def test_parse_resume_gate_rejects_non_resume():
    resp = client.post(
        "/api/llm/parse-resume",
        json={"resumeText": COVER_LETTER_TEXT, "apiKeys": {"provider": "openai", "apiKey": "sk-test", "model": "gpt-4o"}},
    )
    assert resp.status_code == 422
    body = resp.json()["detail"]
    assert body["code"] == "not_a_resume"
    assert body["kind"] == "cover-letter"


def test_parse_resume_gate_accepts_resume():
    resp = client.post(
        "/api/llm/parse-resume",
        json={"resumeText": RESUME_TEXT, "apiKeys": {"provider": "openai", "apiKey": "sk-test", "model": "gpt-4o"}},
    )
    # Gate passes (resume-like), so the route proceeds to the LLM call -> not a 422 gate rejection.
    assert resp.status_code != 422
    if resp.status_code == 200:
        assert resp.json()["documentType"]["is_resume_like"] is True


def test_parse_resume_force_bypasses_gate():
    resp = client.post(
        "/api/llm/parse-resume",
        json={
            "resumeText": COVER_LETTER_TEXT,
            "force": True,
            "apiKeys": {"provider": "openai", "apiKey": "sk-test", "model": "gpt-4o"},
        },
    )
    # With no real provider reachable the route proceeds past the gate to the LLM call -> 502.
    assert resp.status_code in (502, 500)


def test_ats_file_gate_rejects_non_resume():
    entitlements.set_plan(PRO_CLIENT, plan="pro", months=12)
    resp = client.post(
        "/api/ats/file",
        files={"file": ("cover.txt", COVER_LETTER_TEXT, "text/plain")},
        headers={"X-Client-Key": PRO_CLIENT},
    )
    assert resp.status_code == 422
    body = resp.json()["detail"]
    assert body["code"] == "not_a_resume"


def test_upload_extract_returns_document_type():
    resp = client.post(
        "/api/upload/extract",
        files={"file": ("resume.txt", RESUME_TEXT, "text/plain")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["documentType"]["kind"] == "resume"
    assert body["documentType"]["is_resume_like"] is True