import json
import re
from typing import Any

from SimplerLLM.language import LLM, LLMProvider


class LLMService:
    """Thin wrapper over SimplerLLM for the resume builder.

    Supports provider strings: 'openai', 'anthropic', 'google' (gemini), 'ollama'.
    Keys are supplied by the caller per-request (from the browser) and are never
    logged or persisted here.
    """

    def __init__(self, provider: str, api_key: str | None, model: str | None):
        self.provider = provider
        self.api_key = api_key
        self.model = model
        self.llm = self._build()

    def _build(self) -> LLM:
        provider_map = {
            "openai": LLMProvider.OPENAI,
            "anthropic": LLMProvider.ANTHROPIC,
            "google": LLMProvider.GEMINI,
            "ollama": LLMProvider.OLLAMA,
        }
        mapped = provider_map.get(self.provider)
        if mapped is None:
            raise ValueError(f"Unsupported provider: {self.provider}")

        return LLM.create(
            provider=mapped,
            model_name=self.model,
            api_key=self.api_key,
            temperature=0.4,
        )

    def generate(self, prompt: str, max_tokens: int = 2000) -> str:
        response = self.llm.generate_response(
            prompt=prompt,
            system_prompt="You are an expert resume writer and career coach.",
            max_tokens=max_tokens,
        )
        if isinstance(response, dict):
            text = response.get("text") or response.get("content") or ""
            return str(text).strip()
        return str(response).strip()

    def generate_json(self, prompt: str, max_tokens: int = 4000) -> dict[str, Any]:
        """Ask the model for JSON and coerce the reply into a dict."""
        try:
            response = self.llm.generate_response(
                prompt=prompt,
                system_prompt="You are an expert resume writer and career coach. Respond with valid JSON only.",
                max_tokens=max_tokens,
                json_mode=True,
            )
        except Exception:
            response = self.llm.generate_response(
                prompt=prompt,
                system_prompt="You are an expert resume writer and career coach. Respond with valid JSON only.",
                max_tokens=max_tokens,
            )

        if isinstance(response, dict):
            raw = response.get("text") or response.get("content")
        else:
            raw = response
        return self._parse_json(str(raw))

    @staticmethod
    def _parse_json(raw: str) -> dict[str, Any]:
        dirty = raw.strip()
        # Strip markdown code fences
        dirty = re.sub(r"^```(?:json)?\s*", "", dirty)
        dirty = re.sub(r"\s*```$", "", dirty)
        try:
            return json.loads(dirty)
        except json.JSONDecodeError:
            pass
        # Fallback: grab the first {...} block
        match = re.search(r"\{[\s\S]*\}", dirty)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        raise ValueError(f"LLM did not return valid JSON. Raw: {raw[:500]}")