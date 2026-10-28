import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status

from app.deps import get_current_user
from app.services.ingest import IngestError, build_chunks, extract_pages

router = APIRouter(prefix="/documents", tags=["documents"])
log = logging.getLogger("documind")


@router.post("", status_code=status.HTTP_201_CREATED)
def upload_document(file: UploadFile, request: Request,
                          user: dict = Depends(get_current_user)):
    state = request.app.state
    s = state.settings
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

    started = time.perf_counter()
    try:
        pages = extract_pages(data, s.max_pages)
        chunks = build_chunks(pages, s.chunk_size, s.chunk_overlap)
    except IngestError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    extracted = time.perf_counter()

    embeddings = state.embedder.embed([c.text for c in chunks])
    embedded = time.perf_counter()
    # Indexing is the slowest thing the app does; log where the time went so a
    # slow upload can be diagnosed without guessing.
    log.info(
        "indexed %s: %d pages, %d chunks, batch_size=%s | extract %.2fs, embed %.2fs",
        filename, len(pages), len(chunks),
        getattr(state.embedder, "batch_size", "n/a"),
        extracted - started, embedded - extracted,
    )

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
    return {"id": doc_id, "filename": filename, "pages": len(pages), "chunks": len(chunks)}


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
