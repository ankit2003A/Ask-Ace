import httpx
import pytest

from app.services import llm as llm_module
from app.services.llm import LLMClient, LLMError, LLMNotConfigured


def respond(monkeypatch, status, body=None, seen=None):
    def fake_post(url, headers, json, timeout):
        if seen is not None:
            seen.append(headers["Authorization"])
        return httpx.Response(status, json=body or {}, request=httpx.Request("POST", url))

    monkeypatch.setattr(llm_module.httpx, "post", fake_post)


def ok_body(text="Hello"):
    return {"choices": [{"message": {"content": text}}]}


def test_a_rejected_key_is_reported_as_a_configuration_problem(monkeypatch):
    for status in (401, 403):
        respond(monkeypatch, status)
        with pytest.raises(LLMNotConfigured, match="LLM_API_KEY"):
            LLMClient("bad-key", "https://example.com/v1", "m").complete([])


def test_stray_whitespace_and_quotes_around_the_key_are_removed(monkeypatch):
    seen = []
    respond(monkeypatch, 200, ok_body(), seen)
    for pasted in ['gsk_abc\n', ' "gsk_abc" ', "'gsk_abc'"]:
        assert LLMClient(pasted, "https://example.com/v1", "m").complete([]) == "Hello"
    assert seen == ["Bearer gsk_abc"] * 3


def test_other_provider_errors_stay_gateway_errors(monkeypatch):
    respond(monkeypatch, 500)
    with pytest.raises(LLMError) as exc:
        LLMClient("k", "https://example.com/v1", "m").complete([])
    assert not isinstance(exc.value, LLMNotConfigured)


def test_a_missing_key_never_calls_the_provider(monkeypatch):
    respond(monkeypatch, 200, ok_body())
    with pytest.raises(LLMNotConfigured):
        LLMClient("  ", "https://example.com/v1", "m").complete([])
