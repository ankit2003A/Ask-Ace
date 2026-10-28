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

    def complete(self, messages: list[dict], *, timeout: float | None = None,
                 temperature: float = 0.1, json_object: bool = False) -> str:
        """One chat completion.

        `timeout` overrides the client default for slow jobs such as writing a
        whole practice test. `json_object` asks the provider to constrain the
        reply to valid JSON where it supports that.
        """
        if not self.api_key:
            raise LLMNotConfigured("LLM_API_KEY is not set on the server.")
        payload: dict = {"model": self.model, "messages": messages,
                         "temperature": temperature}
        if json_object:
            payload["response_format"] = {"type": "json_object"}
        try:
            resp = httpx.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload,
                timeout=self.timeout if timeout is None else timeout,
            )
        except httpx.HTTPError as exc:
            raise LLMError("Could not reach the LLM provider.") from exc
        if resp.status_code == 429:
            raise LLMError("LLM rate limit reached; try again shortly.")
        if resp.status_code == 400 and json_object:
            code, reason = _json_failure(resp)
            if code == "json_validate_failed":
                # The model answered in prose instead of the required shape —
                # usually because it judged the task impossible. Its own words
                # are far more use than "bad JSON", so pass them on.
                raise LLMError(reason or "The model did not answer in the required format.")
            # Not every OpenAI-compatible provider implements response_format.
            # Fall back to prompt-only JSON rather than failing the request.
            return self.complete(messages, timeout=timeout, temperature=temperature)
        if resp.status_code >= 400:
            raise LLMError(f"LLM provider returned an error ({resp.status_code}).")
        try:
            return resp.json()["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, ValueError) as exc:
            raise LLMError("Unexpected response from the LLM provider.") from exc


def _json_failure(resp) -> tuple[str, str]:
    """(error code, the model's own explanation) from a JSON-mode rejection."""
    try:
        error = resp.json()["error"]
    except (KeyError, ValueError, TypeError):
        return "", ""
    text = " ".join(str(error.get("failed_generation", "")).split())
    if len(text) > 300:
        text = text[:300].rsplit(" ", 1)[0] + "…"
    return str(error.get("code", "")), text
