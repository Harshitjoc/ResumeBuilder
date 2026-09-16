import json
import re
from typing import Any

from app import config


class LLMService:
    """Thin wrapper over SimplerLLM for the resume builder.

    Supports provider strings: 'openai', 'anthropic', 'google' (gemini), 'ollama',
    'openrouter', and 'omniroute' (any OpenAI-compatible endpoint). Keys are
    supplied by the caller per-request (from the browser) and are never logged
    or persisted here.
    """

    def __init__(
        self,
        provider: str,
        api_key: str | None,
        model: str | None,
        base_url: str | None = None,
    ):
        self.provider = provider
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self.llm = self._build()

    def _build(self) -> Any:
        if self.provider == "omniroute":
            return _OpenAICompat(
                api_key=self.api_key,
                base_url=self.base_url or config.OMNIROUTE_BASE_URL,
                model=self.model or "auto",
            )

        from SimplerLLM.language import LLM, LLMProvider

        provider_map = {
            "openai": LLMProvider.OPENAI,
            "anthropic": LLMProvider.ANTHROPIC,
            "google": LLMProvider.GEMINI,
            "ollama": LLMProvider.OLLAMA,
            "openrouter": LLMProvider.OPENROUTER,
        }
        mapped = provider_map.get(self.provider)
        if mapped is None:
            raise ValueError(f"Unsupported provider: {self.provider}")

        if mapped == LLMProvider.OLLAMA:
            # The api_key field carries the Ollama base URL. Normalize it so we
            # always hit the native host Ollama: on Windows, "localhost" can
            # resolve to a Docker Desktop / WSL relay bound to ::1 that serves a
            # *different* model set, causing "model not found" errors.
            base = (self.api_key or "http://127.0.0.1:11434").strip().rstrip("/")
            base = base.replace("://localhost:", "://127.0.0.1:").replace("://localhost/", "://127.0.0.1/")
            if not base.startswith(("http://", "https://")):
                base = "http://" + base
            return LLM.create(
                provider=mapped,
                model_name=self.model or "llama3",
                api_key=base,
                temperature=0.4,
            )

        if mapped == LLMProvider.OPENROUTER:
            return LLM.create(
                provider=mapped,
                model_name=self.model or "openai/gpt-4o-mini",
                api_key=self.api_key,
                temperature=0.4,
            )

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


class _OpenAICompat:
    """Minimal OpenAI-compatible adapter for the 'omniroute' provider.

    SimplerLLM has no generic custom-endpoint support (LLM.create accepts no
    base_url), so we drive the already-installed `openai` SDK directly against
    any OpenAI-compatible base URL. Exposes the same `generate_response` surface
    the rest of LLMService uses.
    """

    def __init__(self, api_key: str | None, base_url: str, model: str):
        from openai import OpenAI

        self.base_url = base_url
        self.model = model
        self.client = OpenAI(api_key=api_key or "not-a-key", base_url=base_url, timeout=120)

    def generate_response(
        self,
        prompt: str,
        system_prompt: str = "You are a helpful assistant.",
        max_tokens: int = 2000,
        json_mode: bool = False,
    ) -> Any:
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.4,
            "max_tokens": max_tokens,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        try:
            completion = self.client.chat.completions.create(**kwargs)
        except Exception as e:
            # Some compatible endpoints reject response_format -> drop it once.
            if json_mode and getattr(e, "status_code", None) in (400, 422):
                kwargs.pop("response_format", None)
                completion = self.client.chat.completions.create(**kwargs)
            else:
                raise
        content = (completion.choices[0].message.content or "").strip()
        return {"text": content}