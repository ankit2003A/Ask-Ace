"""Minimal client for any OpenAI-compatible chat-completions endpoint
(Groq, Gemini's OpenAI-compat endpoint, OpenAI, a local Ollama server, ...)."""
import httpx


class LLMError(Exception):
    """The LLM provider could not produce an answer."""


class LLMNotConfigured(LLMError):
    pass


class LLMClient:
    def __init__(self, api_key: str, base_url: str, model: str, timeout: float = 30.0):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def complete(self, messages: list[dict]) -> str:
        if not self.api_key:
            raise LLMNotConfigured("LLM_API_KEY is not set on the server.")
        try:
            resp = httpx.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.model, "messages": messages, "temperature": 0.1},
                timeout=self.timeout,
            )
        except httpx.HTTPError as exc:
            raise LLMError("Could not reach the LLM provider.") from exc
        if resp.status_code == 429:
            raise LLMError("LLM rate limit reached; try again shortly.")
        if resp.status_code >= 400:
            raise LLMError(f"LLM provider returned an error ({resp.status_code}).")
        try:
            return resp.json()["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, ValueError) as exc:
            raise LLMError("Unexpected response from the LLM provider.") from exc
