import pytest

from app.services.ingest import IngestError, build_chunks, extract_pages, split_text
from tests.conftest import make_pdf


def test_short_text_is_one_chunk():
    assert split_text("hello world", 100, 10) == ["hello world"]


def test_chunks_respect_size_and_overlap():
    text = " ".join(f"word{i}" for i in range(400))
    pieces = split_text(text, 200, 40)
    assert len(pieces) > 5
    assert all(len(p) <= 200 for p in pieces)
    # consecutive chunks share text (overlap), so no content is lost at boundaries
    assert any(set(a.split()[-3:]) & set(b.split()[:8]) for a, b in zip(pieces, pieces[1:]))
    assert set(text.split()) == set(" ".join(pieces).split())


def test_invalid_chunk_params():
    with pytest.raises(ValueError):
        split_text("x" * 500, 100, 100)


def test_chunks_keep_page_numbers():
    pages = extract_pages(make_pdf(["alpha beta gamma", "", "delta epsilon"]), 50)
    assert [p for p, _ in pages] == [1, 3]
    chunks = build_chunks(pages, 1000, 100)
    assert [c.page for c in chunks] == [1, 3] and [c.index for c in chunks] == [0, 1]


def test_page_limit():
    with pytest.raises(IngestError):
        extract_pages(make_pdf(["a b c"] * 3), max_pages=2)


def test_embedder_passes_the_configured_batch_size():
    """batch_size is the difference between 5 seconds and 19; make sure it
    actually reaches fastembed rather than silently defaulting."""
    from app.services.embeddings import FastEmbedder

    class FakeModel:
        def __init__(self):
            self.kwargs = None

        def embed(self, texts, **kwargs):
            self.kwargs = kwargs
            # fastembed yields numpy arrays, so mimic .tolist().
            return [FakeVector() for _ in texts]

    class FakeVector:
        def tolist(self):
            return [0.1, 0.2]

    embedder = FastEmbedder("some-model", batch_size=1)
    embedder._model = FakeModel()  # skip the real model download
    out = embedder.embed(["a", "b"])

    assert embedder._model.kwargs == {"batch_size": 1}
    assert out == [[0.1, 0.2], [0.1, 0.2]]
