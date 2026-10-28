import json

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.deps import get_current_user
from app.schemas import AskIn
from app.services import rag
from app.services.llm import LLMError, LLMNotConfigured

router = APIRouter(tags=["chat"])


@router.post("/ask")
def ask(body: AskIn, request: Request, user: dict = Depends(get_current_user)):
    state = request.app.state
    s = state.settings

    if body.document_id is not None:
        with state.db.session() as c:
            owned = c.execute("SELECT 1 FROM documents WHERE id = ? AND user_id = ?",
                              (body.document_id, user["id"])).fetchone()
        if owned is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")

    question = body.question.strip()

    social = rag.social_reply(question)
    if social is not None:
        # Small talk: no retrieval, no LLM call.
        answer, sources = social, []
    else:
        query_vec = state.embedder.embed([question])[0]
        hits = rag.select_hits(
            state.store.query(query_vec, user["id"], s.top_k, body.document_id),
            s.max_distance,
        )

        if not hits:
            answer, sources = rag.NOT_FOUND_HELP, []
        else:
            with state.db.session() as c:
                rows = c.execute(
                    "SELECT role, content FROM messages WHERE user_id = ? "
                    "ORDER BY id DESC LIMIT 4", (user["id"],)).fetchall()
            history = [dict(r) for r in reversed(rows)]
            try:
                answer = state.llm.complete(rag.build_messages(question, hits, history))
            except LLMNotConfigured as exc:
                raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))
            except LLMError as exc:
                raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))
            # The passages were retrieved but did not hold the answer; citing
            # them under a refusal would only mislead.
            if rag.is_not_found(answer):
                answer, sources = rag.NOT_FOUND_HELP, []
            else:
                sources = rag.to_sources(hits)

    with state.db.session() as c:
        c.execute("INSERT INTO messages (user_id, document_id, role, content) VALUES (?,?,?,?)",
                  (user["id"], body.document_id, "user", question))
        c.execute("INSERT INTO messages (user_id, document_id, role, content, sources) "
                  "VALUES (?,?,?,?,?)",
                  (user["id"], body.document_id, "assistant", answer, json.dumps(sources)))
    return {"answer": answer, "sources": sources}


@router.get("/history")
def history(request: Request, user: dict = Depends(get_current_user)):
    with request.app.state.db.session() as c:
        rows = c.execute(
            "SELECT id, role, content, sources, created_at FROM messages "
            "WHERE user_id = ? ORDER BY id", (user["id"],)).fetchall()
    return [
        {**dict(r), "sources": json.loads(r["sources"]) if r["sources"] else []}
        for r in rows
    ]


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
def clear_history(request: Request, user: dict = Depends(get_current_user)):
    with request.app.state.db.session() as c:
        c.execute("DELETE FROM messages WHERE user_id = ?", (user["id"],))
