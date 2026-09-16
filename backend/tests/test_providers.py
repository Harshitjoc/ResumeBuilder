"""Provider wiring tests: 'openrouter' (SimplerLLM's built-in OPENROUTER) and
'omniroute' (OpenAI-compatible endpoint driven through the openai SDK).

Build-only, no network: both SDKs construct clients lazily, so nothing HTTP
happens until generate() is called.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402

from app import config  # noqa: E402
from app.routers.llm import ApiKeys, _service  # noqa: E402
from app.services.llm import _OpenAICompat, LLMService  # noqa: E402


def test_openrouter_builds():
    svc = LLMService(provider="openrouter", api_key="sk-or-test", model="openai/gpt-4o-mini")
    assert svc.provider == "openrouter"


def test_openrouter_builds_without_model():
    LLMService(provider="openrouter", api_key="sk-or-test", model=None)


def test_openrouter_route_accepts_provider():
    keys = ApiKeys(provider="openrouter", apiKey="sk-or-test", model="openai/gpt-4o-mini")
    svc = _service(keys)
    assert svc.provider == "openrouter"


def test_omniroute_builds():
    svc = LLMService(provider="omniroute", api_key="omni-test", model="auto")
    assert isinstance(svc.llm, _OpenAICompat)
    assert svc.llm.base_url == config.OMNIROUTE_BASE_URL
    assert svc.llm.model == "auto"


def test_omniroute_base_url_override():
    svc = LLMService(
        provider="omniroute",
        api_key="omni-test",
        model="auto",
        base_url="http://localhost:20128/v1",
    )
    assert svc.llm.base_url == "http://localhost:20128/v1"


def test_api_keys_accepts_base_url():
    keys = ApiKeys.model_validate_json(
        '{"provider": "omniroute", "apiKey": "k", "model": "auto", "baseUrl": "http://localhost:20128/v1"}'
    )
    assert keys.baseUrl == "http://localhost:20128/v1"


def test_omniroute_route_accepts_provider():
    keys = ApiKeys(provider="omniroute", apiKey="omni-test", model="auto")
    svc = _service(keys)
    assert isinstance(svc.llm, _OpenAICompat)


def test_unknown_provider_still_rejected():
    with pytest.raises(ValueError):
        LLMService(provider="bogus", api_key="k", model=None)