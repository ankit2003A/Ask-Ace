"""Practice tests generated from a user's own indexed documents.

Correct answers are never sent to the browser. The client posts responses and
the server grades them, so the answer key cannot be read out of the page.
"""
import json

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.deps import get_current_user
from app.schemas import AttemptIn, ExamIn
from app.services import exams as exam_service
from app.services.exams import ExamError
from app.services.llm import LLMError, LLMNotConfigured

router = APIRouter(prefix="/exams", tags=["exams"])


def _owned_document(state, document_id: int, user_id: int) -> dict:
    with state.db.session() as c:
        row = c.execute(
            "SELECT id, filename, pages FROM documents WHERE id = ? AND user_id = ?",
            (document_id, user_id),
        ).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return dict(row)


def _owned_exam(state, exam_id: int, user_id: int) -> dict:
    with state.db.session() as c:
        row = c.execute(
            "SELECT e.id, e.document_id, e.title, e.question_type, e.difficulty, "
            "e.created_at, d.filename FROM exams e "
            "JOIN documents d ON d.id = e.document_id "
            "WHERE e.id = ? AND e.user_id = ?",
            (exam_id, user_id),
        ).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Test not found")
    return dict(row)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_exam(body: ExamIn, request: Request, user: dict = Depends(get_current_user)):
    state = request.app.state
    s = state.settings
    document = _owned_document(state, body.document_id, user["id"])

    chunks = state.store.document_chunks(document["id"], user["id"])
    if not chunks:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "This document has no indexed text to draw questions from.")

    asked_for = min(body.count, s.exam_max_questions)
    selected = exam_service.select_coverage(chunks, s.exam_context_chars)
    count = exam_service.supported_count(selected, asked_for)
    messages = exam_service.build_messages(
        document["filename"], selected, count, body.question_type, body.difficulty
    )

    try:
        raw = state.llm.complete(
            messages,
            timeout=s.exam_timeout_seconds,
            # A little warmth, or every regeneration returns the same test.
            temperature=0.4,
            json_object=True,
        )
    except LLMNotConfigured as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))
    except LLMError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))

    try:
        questions, dropped = exam_service.parse_questions(
            raw, body.question_type, document["pages"], count
        )
    except ExamError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))

    title = f"{document['filename']} — {len(questions)} questions"
    with state.db.session() as c:
        cur = c.execute(
            "INSERT INTO exams (user_id, document_id, title, question_type, difficulty) "
            "VALUES (?,?,?,?,?)",
            (user["id"], document["id"], title, body.question_type, body.difficulty),
        )
        exam_id = cur.lastrowid
        c.executemany(
            "INSERT INTO questions (exam_id, position, kind, prompt, options, answer, "
            "explanation, page) VALUES (?,?,?,?,?,?,?,?)",
            [
                (exam_id, i, q["kind"], q["prompt"],
                 json.dumps(q["options"]) if q["options"] else None,
                 q["answer"], q["explanation"], q["page"])
                for i, q in enumerate(questions)
            ],
        )

    return {
        **_public_exam(state, exam_id, user["id"]),
        # Surfaced so a short test is explained rather than looking like a bug.
        "requested": asked_for,
        "discarded": dropped,
        # True when the document was too short to carry what was asked for.
        "limited_by_document": count < asked_for,
    }


def _public_exam(state, exam_id: int, user_id: int) -> dict:
    """An exam and its questions with the answer key removed."""
    exam = _owned_exam(state, exam_id, user_id)
    with state.db.session() as c:
        rows = c.execute(
            "SELECT id, position, kind, prompt, options, page FROM questions "
            "WHERE exam_id = ? ORDER BY position", (exam_id,)
        ).fetchall()
    return {
        **exam,
        "questions": [
            {"id": r["id"], "position": r["position"], "kind": r["kind"],
             "prompt": r["prompt"],
             "options": json.loads(r["options"]) if r["options"] else None}
            for r in rows
        ],
    }


@router.get("")
def list_exams(request: Request, user: dict = Depends(get_current_user)):
    with request.app.state.db.session() as c:
        rows = c.execute(
            "SELECT e.id, e.document_id, e.title, e.question_type, e.difficulty, "
            "e.created_at, d.filename, "
            "(SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS questions, "
            "(SELECT MAX(a.score) FROM attempts a WHERE a.exam_id = e.id) AS best_score, "
            "(SELECT COUNT(*) FROM attempts a WHERE a.exam_id = e.id) AS attempts "
            "FROM exams e JOIN documents d ON d.id = e.document_id "
            "WHERE e.user_id = ? ORDER BY e.id DESC", (user["id"],)
        ).fetchall()
    return [dict(r) for r in rows]


@router.get("/{exam_id}")
def get_exam(exam_id: int, request: Request, user: dict = Depends(get_current_user)):
    return _public_exam(request.app.state, exam_id, user["id"])


@router.post("/{exam_id}/attempt")
def submit_attempt(exam_id: int, body: AttemptIn, request: Request,
                   user: dict = Depends(get_current_user)):
    state = request.app.state
    _owned_exam(state, exam_id, user["id"])

    with state.db.session() as c:
        rows = c.execute(
            "SELECT id, position, kind, prompt, options, answer, explanation, page "
            "FROM questions WHERE exam_id = ? ORDER BY position", (exam_id,)
        ).fetchall()

    given = {r.question_id: r.answer for r in body.responses}
    results = []
    for r in rows:
        response = given.get(r["id"], "")
        correct = exam_service.grade(r["kind"], r["answer"], response)
        results.append({
            "id": r["id"],
            "position": r["position"],
            "kind": r["kind"],
            "prompt": r["prompt"],
            "options": json.loads(r["options"]) if r["options"] else None,
            "your_answer": response,
            "correct_answer": r["answer"],
            "explanation": r["explanation"],
            "page": r["page"],
            "correct": correct,
            # Short answers are matched on wording, so flag them as approximate.
            "approximate": r["kind"] == "short",
        })

    score = sum(1 for r in results if r["correct"])
    with state.db.session() as c:
        c.execute("INSERT INTO attempts (exam_id, user_id, score, total) VALUES (?,?,?,?)",
                  (exam_id, user["id"], score, len(results)))

    return {"exam_id": exam_id, "score": score, "total": len(results), "results": results}


@router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exam(exam_id: int, request: Request, user: dict = Depends(get_current_user)):
    state = request.app.state
    _owned_exam(state, exam_id, user["id"])
    with state.db.session() as c:
        # questions and attempts cascade from exams.
        c.execute("DELETE FROM exams WHERE id = ?", (exam_id,))
