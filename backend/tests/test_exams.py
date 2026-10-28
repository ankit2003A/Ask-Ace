import json

import pytest

from app.services import exams
from app.services.exams import ExamError
from app.services.llm import LLMError, LLMNotConfigured
from tests.conftest import register


def reply(questions):
    return json.dumps({"questions": questions})


MCQ = {
    "kind": "mcq",
    "prompt": "What do chloroplasts do?",
    "options": ["Convert light energy", "Store water", "Digest protein"],
    "answer": "Convert light energy",
    "explanation": "Stated on page 2.",
    "page": 2,
}


def create(client, auth, llm, doc, questions=None, **body):
    llm.answer = reply(questions if questions is not None else [MCQ])
    payload = {"document_id": doc["id"], "count": 1, "question_type": "mcq", **body}
    return client.post("/exams", headers=auth, json=payload)


# --- generation ---------------------------------------------------------

def test_generating_a_test_stores_questions_without_the_answer_key(client, auth, llm, uploaded):
    r = create(client, auth, llm, uploaded)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["document_id"] == uploaded["id"]
    assert len(body["questions"]) == 1
    question = body["questions"][0]
    assert question["prompt"] == MCQ["prompt"]
    assert question["options"] == MCQ["options"]
    # The correct answer must never reach the browser.
    assert "answer" not in question
    assert "explanation" not in question


def test_generation_sends_the_whole_document_not_a_query_match(client, auth, llm, uploaded):
    create(client, auth, llm, uploaded)
    prompt = llm.calls[-1][-1]["content"]
    # Both pages of the fixture PDF should be in front of the model.
    assert "page 1" in prompt and "page 2" in prompt
    assert "gardening" in prompt and "chloroplasts" in prompt


def test_generation_asks_for_json_and_a_longer_timeout(client, auth, llm, uploaded):
    create(client, auth, llm, uploaded)
    options = llm.options[-1]
    assert options["json_object"] is True
    assert options["timeout"] > 30


def test_cannot_generate_from_another_users_document(client, llm, uploaded):
    other = register(client, email="other@example.com")
    llm.answer = reply([MCQ])
    r = client.post("/exams", headers=other,
                    json={"document_id": uploaded["id"], "count": 1, "question_type": "mcq"})
    assert r.status_code == 404


def test_unusable_model_output_is_reported_not_stored(client, auth, llm, uploaded):
    llm.answer = "I'd rather not."
    r = client.post("/exams", headers=auth,
                    json={"document_id": uploaded["id"], "count": 1, "question_type": "mcq"})
    assert r.status_code == 502
    assert client.get("/exams", headers=auth).json() == []


def test_llm_failures_surface_as_gateway_errors(client, auth, llm, uploaded):
    llm.error = LLMError("boom")
    r = client.post("/exams", headers=auth,
                    json={"document_id": uploaded["id"], "count": 1, "question_type": "mcq"})
    assert r.status_code == 502

    llm.error = LLMNotConfigured("no key")
    r = client.post("/exams", headers=auth,
                    json={"document_id": uploaded["id"], "count": 1, "question_type": "mcq"})
    assert r.status_code == 503


@pytest.mark.parametrize("field,value", [
    ("count", 0), ("count", 99), ("question_type", "essay"), ("difficulty", "brutal"),
])
def test_invalid_configuration_is_rejected(client, auth, uploaded, field, value):
    payload = {"document_id": uploaded["id"], "count": 1, "question_type": "mcq",
               "difficulty": "mixed", field: value}
    assert client.post("/exams", headers=auth, json=payload).status_code == 422


def test_partly_bad_output_keeps_the_good_questions_and_counts_the_rest(client, auth, llm, uploaded):
    bad = {**MCQ, "prompt": "Unanswerable?", "answer": "Not among the options"}
    r = create(client, auth, llm, uploaded, questions=[MCQ, bad], count=2)
    assert r.status_code == 201
    body = r.json()
    assert len(body["questions"]) == 1
    assert body["discarded"] == 1
    assert body["requested"] == 2


# --- taking a test ------------------------------------------------------

def test_listing_and_fetching_a_test(client, auth, llm, uploaded):
    exam_id = create(client, auth, llm, uploaded).json()["id"]

    listed = client.get("/exams", headers=auth).json()
    assert [e["id"] for e in listed] == [exam_id]
    assert listed[0]["questions"] == 1
    assert listed[0]["attempts"] == 0
    assert listed[0]["best_score"] is None

    fetched = client.get(f"/exams/{exam_id}", headers=auth).json()
    assert fetched["questions"][0]["prompt"] == MCQ["prompt"]


def test_a_correct_attempt_is_graded_and_recorded(client, auth, llm, uploaded):
    exam = create(client, auth, llm, uploaded).json()
    qid = exam["questions"][0]["id"]

    r = client.post(f"/exams/{exam['id']}/attempt", headers=auth,
                    json={"responses": [{"question_id": qid, "answer": MCQ["answer"]}]})
    assert r.status_code == 200
    body = r.json()
    assert (body["score"], body["total"]) == (1, 1)
    result = body["results"][0]
    assert result["correct"] is True
    # Only now does the answer key come back, together with where to revise.
    assert result["correct_answer"] == MCQ["answer"]
    assert result["explanation"] == MCQ["explanation"]
    assert result["page"] == 2

    assert client.get("/exams", headers=auth).json()[0]["best_score"] == 1


def test_a_wrong_or_missing_answer_scores_zero(client, auth, llm, uploaded):
    exam = create(client, auth, llm, uploaded).json()
    qid = exam["questions"][0]["id"]

    wrong = client.post(f"/exams/{exam['id']}/attempt", headers=auth,
                        json={"responses": [{"question_id": qid, "answer": "Store water"}]})
    assert wrong.json()["score"] == 0

    skipped = client.post(f"/exams/{exam['id']}/attempt", headers=auth,
                          json={"responses": []})
    assert skipped.json()["score"] == 0
    assert skipped.json()["results"][0]["your_answer"] == ""


def test_another_user_cannot_read_take_or_delete_a_test(client, llm, uploaded, auth):
    exam_id = create(client, auth, llm, uploaded).json()["id"]
    other = register(client, email="other@example.com")

    assert client.get(f"/exams/{exam_id}", headers=other).status_code == 404
    assert client.post(f"/exams/{exam_id}/attempt", headers=other,
                       json={"responses": []}).status_code == 404
    assert client.delete(f"/exams/{exam_id}", headers=other).status_code == 404
    assert client.get("/exams", headers=other).json() == []


def test_exam_endpoints_require_authentication(client):
    assert client.get("/exams").status_code == 401
    assert client.post("/exams", json={"document_id": 1}).status_code == 401


def test_deleting_a_test_removes_it(client, auth, llm, uploaded):
    exam_id = create(client, auth, llm, uploaded).json()["id"]
    assert client.delete(f"/exams/{exam_id}", headers=auth).status_code == 204
    assert client.get(f"/exams/{exam_id}", headers=auth).status_code == 404


def test_deleting_the_document_removes_its_tests(client, auth, llm, uploaded):
    create(client, auth, llm, uploaded)
    assert client.delete(f"/documents/{uploaded['id']}", headers=auth).status_code == 204
    assert client.get("/exams", headers=auth).json() == []


# --- service unit tests -------------------------------------------------

def test_coverage_spans_the_document_rather_than_its_opening():
    chunks = [{"index": i, "text": "x" * 100, "page": i + 1} for i in range(100)]
    picked = exams.select_coverage(chunks, budget_chars=1000)
    assert len(picked) <= 12
    assert picked[0]["index"] == 0
    # The tail of the document must be represented too.
    assert picked[-1]["index"] > 80


def test_short_documents_are_passed_through_whole():
    chunks = [{"index": i, "text": "short", "page": 1} for i in range(3)]
    assert exams.select_coverage(chunks, budget_chars=1000) == chunks


def test_json_is_recovered_from_code_fences_and_prose():
    fenced = "```json\n" + reply([MCQ]) + "\n```"
    assert exams.parse_questions(fenced, "mcq", 2, 5)[0][0]["prompt"] == MCQ["prompt"]
    chatty = "Here you go:\n" + reply([MCQ]) + "\nHope that helps!"
    assert exams.parse_questions(chatty, "mcq", 2, 5)[0][0]["prompt"] == MCQ["prompt"]


def test_questions_of_the_wrong_kind_are_dropped():
    tf = {"kind": "truefalse", "prompt": "Plants photosynthesise.", "answer": "true", "page": 2}
    kept, dropped = exams.parse_questions(reply([MCQ, tf]), "mcq", 2, 5)
    assert [q["kind"] for q in kept] == ["mcq"]
    assert dropped == 1


def test_true_false_answers_are_normalized():
    tf = {"kind": "truefalse", "prompt": "Plants photosynthesise.", "answer": "TRUE.", "page": 1}
    kept, _ = exams.parse_questions(reply([tf]), "truefalse", 2, 5)
    assert kept[0]["answer"] == "True"
    assert kept[0]["options"] == ["True", "False"]


def test_a_page_outside_the_document_is_discarded_not_stored():
    kept, _ = exams.parse_questions(reply([{**MCQ, "page": 99}]), "mcq", 2, 5)
    assert kept[0]["page"] is None


def test_duplicate_prompts_are_dropped():
    kept, dropped = exams.parse_questions(reply([MCQ, dict(MCQ)]), "mcq", 2, 5)
    assert len(kept) == 1 and dropped == 1


def test_nothing_usable_raises():
    with pytest.raises(ExamError):
        exams.parse_questions(reply([{"kind": "mcq", "prompt": "", "answer": ""}]), "mcq", 2, 5)
    with pytest.raises(ExamError):
        exams.parse_questions("not json at all", "mcq", 2, 5)


def test_mixed_tests_accept_every_kind():
    tf = {"kind": "truefalse", "prompt": "Plants photosynthesise.", "answer": "True", "page": 1}
    short = {"kind": "short", "prompt": "What is a chloroplast?",
             "answer": "The organelle where photosynthesis happens.", "page": 2}
    kept, dropped = exams.parse_questions(reply([MCQ, tf, short]), "mixed", 2, 5)
    assert {q["kind"] for q in kept} == {"mcq", "truefalse", "short"}
    assert dropped == 0


@pytest.mark.parametrize("given,expected_correct", [
    ("Convert light energy", True),
    ("  convert light energy.  ", True),
    ("Store water", False),
    ("", False),
])
def test_choice_grading_is_exact_but_forgiving_of_case(given, expected_correct):
    assert exams.grade("mcq", "Convert light energy", given) is expected_correct


@pytest.mark.parametrize("given,expected_correct", [
    ("The organelle where photosynthesis happens", True),
    ("the ORGANELLE in which photosynthesis happens!", True),
    ("A kind of sugar", False),
])
def test_short_answers_are_graded_on_overlap(given, expected_correct):
    expected = "The organelle where photosynthesis happens."
    assert exams.grade("short", expected, given) is expected_correct


def test_a_short_document_caps_the_number_of_questions_asked_for(client, auth, llm, uploaded):
    r = create(client, auth, llm, uploaded, count=30)
    assert r.status_code == 201
    body = r.json()
    assert body["requested"] == 30
    assert body["limited_by_document"] is True
    # The fixture PDF is a couple of sentences, so far fewer are asked of the model.
    assert "exactly 5 practice questions" in llm.calls[-1][-1]["content"]


def test_a_feasible_request_is_passed_through_unchanged(client, auth, llm, uploaded):
    body = create(client, auth, llm, uploaded, count=1).json()
    assert body["limited_by_document"] is False
    assert "exactly 1 practice questions" in llm.calls[-1][-1]["content"]


@pytest.mark.parametrize("chars,requested,expected", [
    (10_000, 30, 30),    # plenty of material: ask for what was requested
    (10_000, 10, 10),    # never more than asked for
    (300, 30, 5),        # tiny document: floor, not thirty near-duplicates
    (4_500, 30, 30),     # 150 chars per question exactly
    (1_500, 30, 10),     # proportional in between
])
def test_supported_count_scales_with_available_text(chars, requested, expected):
    chunks = [{"index": 0, "text": "x" * chars, "page": 1}]
    assert exams.supported_count(chunks, requested) == expected


def test_a_json_mode_refusal_keeps_the_models_own_explanation():
    from app.services.llm import _json_failure

    class Resp:
        status_code = 400

        def json(self):
            return {"error": {"code": "json_validate_failed",
                              "failed_generation": "There isn't   enough material for 30."}}

    code, reason = _json_failure(Resp())
    assert code == "json_validate_failed"
    # Whitespace is collapsed so the message reads as one line.
    assert reason == "There isn't enough material for 30."


def test_an_unparseable_error_body_yields_no_reason():
    from app.services.llm import _json_failure

    class Resp:
        status_code = 400

        def json(self):
            raise ValueError("not json")

    assert _json_failure(Resp()) == ("", "")
