"""PDF text extraction and chunking.

Chunks never cross page boundaries, so every chunk maps to exactly one
page number and citations are precise.
"""
import io
from dataclasses import dataclass

from pypdf import PdfReader
from pypdf.errors import PdfReadError


class IngestError(Exception):
    """Raised for user-fixable problems with an uploaded file."""


@dataclass
class Chunk:
    text: str
    page: int  # 1-based
    index: int  # position within the document


def extract_pages(data: bytes, max_pages: int) -> list[tuple[int, str]]:
    """Return [(page_number, text)] for pages that contain text."""
    if not data.startswith(b"%PDF"):
        raise IngestError("File is not a valid PDF.")
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise IngestError("Encrypted PDFs are not supported.")
        if len(reader.pages) > max_pages:
            raise IngestError(f"PDF has too many pages (limit {max_pages}).")
        pages = []
        for number, page in enumerate(reader.pages, start=1):
            text = " ".join((page.extract_text() or "").split())
            if text:
                pages.append((number, text))
    except IngestError:
        raise
    except (PdfReadError, ValueError, KeyError, OSError) as exc:
        raise IngestError("Could not read this PDF; it may be corrupted.") from exc
    if not pages:
        raise IngestError(
            "No extractable text found. This looks like a scanned PDF; OCR is not supported."
        )
    return pages


def split_text(text: str, size: int, overlap: int) -> list[str]:
    """Split text into ~size-character pieces with overlap, preferring word boundaries."""
    if size <= 0 or overlap < 0 or overlap >= size:
        raise ValueError("chunk_size must be > 0 and 0 <= overlap < chunk_size")
    if len(text) <= size:
        return [text]
    pieces, start = [], 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            boundary = text.rfind(" ", start + size // 2, end)
            if boundary != -1:
                end = boundary
        piece = text[start:end].strip()
        if piece:
            pieces.append(piece)
        if end >= len(text):
            break
        nxt = max(end - overlap, start + 1)
        if text[nxt - 1] != " ":  # don't start the next chunk mid-word
            space = text.find(" ", nxt, end)
            if space != -1:
                nxt = space + 1
        start = nxt
    return pieces


def build_chunks(pages: list[tuple[int, str]], size: int, overlap: int) -> list[Chunk]:
    chunks: list[Chunk] = []
    for page_number, text in pages:
        for piece in split_text(text, size, overlap):
            chunks.append(Chunk(text=piece, page=page_number, index=len(chunks)))
    return chunks
