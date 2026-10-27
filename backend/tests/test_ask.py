from app.services.llm import LLMError, LLMNotConfigured


def test_answer_has_citations_with_correct_page(client, auth, uploaded, llm):
    r = client.post("/ask", headers=auth, json={"question": "What is photosynthesis?"})
    assert r.status_code == 200
    body = r.json()
    assert "Photosynthesis" in body["answer"]
    top = body["sources"][0]
    assert top["page"] == 2 and top["filename"] == "plants.pdf" and top["index"] == 1
    # The retrieved passage was actually sent to the LLM as context.
    sent = llm.calls[0][-1]["content"]
    assert "chloroplasts" in sent and "[1]" in sent


def test_off_topic_question_returns_not_found_without_calling_llm(client, auth, uploaded, llm):
    r = client.post("/ask", headers=auth, json={"question": "Explain stock market derivatives"})
    assert r.status_code == 200
    assert r.json()["sources"] == []
    assert "couldn't find" in r.json()["answer"]
    assert llm.calls == []


def test_ask_with_no_documents(client, auth, llm):
    r = client.post("/ask", headers=auth, json={"question": "anything at all"})
    assert r.status_code == 200 and r.json()["sources"] == [] and llm.calls == []


def test_scoped_to_document(client, auth, uploaded):
    ok = client.post("/ask", headers=auth, json={"question": "photosynthesis energy", "document_id": uploaded["id"]})
    assert ok.status_code == 200 and ok.json()["sources"]
    missing = client.post("/ask", headers=auth, json={"question": "photosynthesis energy", "document_id": 9999})
    assert missing.status_code == 404


def test_question_validation(client, auth):
    assert client.post("/ask", headers=auth, json={"question": "hi"}).status_code == 422
    assert client.post("/ask", headers=auth, json={"question": "x" * 1001}).status_code == 422
    assert client.post("/ask", headers=auth, json={}).status_code == 422


def test_llm_not_configured_returns_503(client, auth, uploaded, llm):
    llm.error = LLMNotConfigured("LLM_API_KEY is not set on the server.")
    r = client.post("/ask", headers=auth, json={"question": "What is photosynthesis?"})
    assert r.status_code == 503


def test_llm_failure_returns_502(client, auth, uploaded, llm):
    llm.error = LLMError("LLM rate limit reached; try again shortly.")
    r = client.post("/ask", headers=auth, json={"question": "What is photosynthesis?"})
    assert r.status_code == 502 and "rate limit" in r.json()["detail"]


def test_history_is_saved_and_clearable(client, auth, uploaded):
    client.post("/ask", headers=auth, json={"question": "What is photosynthesis?"})
    hist = client.get("/history", headers=auth).json()
    assert [m["role"] for m in hist] == ["user", "assistant"]
    assert hist[1]["sources"][0]["page"] == 2
    assert client.delete("/history", headers=auth).status_code == 204
    assert client.get("/history", headers=auth).json() == []


def test_follow_up_includes_recent_history(client, auth, uploaded, llm):
    client.post("/ask", headers=auth, json={"question": "What is photosynthesis?"})
    client.post("/ask", headers=auth, json={"question": "Where do chloroplasts convert light energy?"})
    roles = [m["role"] for m in llm.calls[1]]
    assert roles == ["system", "user", "assistant", "user"]
