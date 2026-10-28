import json
import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse

from app.deps import get_current_user
from app.services.ingest import IngestError, build_chunks, read_pages

router = APIRouter(prefix="/documents", tags=["documents"])
log = logging.getLogger("documind")

# Progress events while embedding. Embedding is the slow part, but each call
# has a small fixed cost, so report about this many times rather than per chunk.
EMBED_UPDATES = 50


@router.post("", status_code=status.HTTP_201_CREATED)
def upload_document(file: UploadFile, request: Request, stream: bool = False,
                    user: dict = Depends(get_current_user)):
    """Upload and index a PDF.

    By default this answers once, with the indexed document. With
    `?stream=true` it instead streams newline-delimited JSON progress events
    while it works — pages read, chunks embedded, saving — ending in a `done`
    event carrying the document, or an `error` event. That is what lets the UI
    show a real percentage rather than a guess.
    """
    state = request.app.state
    s = state.settings
    # Everything that can be rejected up front is, so these keep their proper
    # status codes even in streaming mode.
    limit = s.max_upload_mb * 1024 * 1024
    data = file.file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            f"File exceeds {s.max_upload_mb} MB limit")
    if not data:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "File is empty")
    filename = (file.filename or "document.pdf").replace("\\", "/").split("/")[-1][:200]
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only PDF files are supported")

    steps = _index(state, user, filename, data)

    if stream:
        return StreamingResponse(
            _ndjson(steps, filename),
            media_type="application/x-ndjson",
            # Ask proxies not to hold the events back until the end.
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    try:
        for step in steps:
            if step["stage"] == "done":
                return step["document"]
    except IngestError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    raise RuntimeError("indexing finished without producing a document")


def _index(state, user: dict, filename: str, data: bytes):
    """Index a PDF, yielding a progress event after each unit of work."""
    s = state.settings
    started = time.perf_counter()

    reading = read_pages(data, s.max_pages)
    while True:
        try:
            done, total = next(reading)
        except StopIteration as finished:
            pages = finished.value
            break
        yield {"stage": "reading", "done": done, "total": total}

    chunks = build_chunks(pages, s.chunk_size, s.chunk_overlap)
    extracted = time.perf_counter()

    # Embedding in slices gives identical vectors (each text is embedded on its
    # own anyway; see Settings.embedding_batch_size) and lets us report progress.
    texts = [c.text for c in chunks]
    step = max(1, len(texts) // EMBED_UPDATES)
    embeddings = []
    yield {"stage": "embedding", "done": 0, "total": len(texts)}
    for start in range(0, len(texts), step):
        embeddings += state.embedder.embed(texts[start:start + step])
        yield {"stage": "embedding", "done": len(embeddings), "total": len(texts)}
    embedded = time.perf_counter()

    # Indexing is the slowest thing the app does; log where the time went so a
    # slow upload can be diagnosed without guessing.
    log.info(
        "indexed %s: %d pages, %d chunks, batch_size=%s | extract %.2fs, embed %.2fs",
        filename, len(pages), len(chunks),
        getattr(state.embedder, "batch_size", "n/a"),
        extracted - started, embedded - extracted,
    )

    yield {"stage": "saving"}
    with state.db.session() as c:
        cur = c.execute(
            "INSERT INTO documents (user_id, filename, pages, chunks) VALUES (?, ?, ?, ?)",
            (user["id"], filename, len(pages), len(chunks)),
        )
        doc_id = cur.lastrowid
        try:
            state.store.add(doc_id, user["id"], filename, chunks, embeddings)
        except Exception:
            state.store.delete_document(doc_id)
            raise
    yield {"stage": "done", "document": {
        "id": doc_id, "filename": filename, "pages": len(pages), "chunks": len(chunks),
    }}


def _ndjson(steps, filename: str):
    """Serialise progress events, turning failures into a final error event.

    The 200 status is already sent once streaming starts, so a problem found
    part-way through (a scanned PDF, say) has to travel as an event instead.
    """
    try:
        for step in steps:
            yield json.dumps(step) + "\n"
    except IngestError as exc:
        yield json.dumps({"stage": "error", "status": 422, "detail": str(exc)}) + "\n"
    except Exception:
        log.exception("indexing %s failed", filename)
        yield json.dumps({"stage": "error", "status": 500,
                          "detail": "Indexing failed on the server."}) + "\n"


@router.get("")
def list_documents(request: Request, user: dict = Depends(get_current_user)):
    with request.app.state.db.session() as c:
        rows = c.execute(
            "SELECT id, filename, pages, chunks, created_at FROM documents "
            "WHERE user_id = ? ORDER BY id DESC", (user["id"],)
        ).fetchall()
    return [dict(r) for r in rows]


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: int, request: Request,
                    user: dict = Depends(get_current_user)):
    state = request.app.state
    with state.db.session() as c:
        row = c.execute("SELECT id FROM documents WHERE id = ? AND user_id = ?",
                        (document_id, user["id"])).fetchone()
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
        state.store.delete_document(document_id)
        c.execute("DELETE FROM documents WHERE id = ?", (document_id,))
