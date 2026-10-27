import io
import re
import zlib

import pytest
from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas

from app.config import Settings
from app.main import create_app
from app.services.llm import LLMError, LLMNotConfigured

STOP = {"the", "a", "an", "of", "is", "are", "and", "to", "in", "on", "what", "how", "does", "do", "for", "it"}


class FakeEmbedder:
    """Deterministic bag-of-words hashing embedder (no model download)."""
    dim = 256

    def embed(self, texts):
        out = []
        for t in texts:
            vec = [0.0] * self.dim
            for w in re.findall(r"[a-z0-9]+", t.lower()):
                if w not in STOP:
                    vec[zlib.crc32(w.encode()) % self.dim] += 1.0
            norm = sum(v * v for v in vec) ** 0.5 or 1.0
            out.append([v / norm for v in vec])
        return out


class FakeLLM:
    def __init__(self):
        self.calls = []
        self.error = None

    def complete(self, messages):
        self.calls.append(messages)
        if self.error:
            raise self.error
        return "Photosynthesis converts light into chemical energy [1]."


def make_pdf(pages: list[str]) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    for text in pages:
        if text:
            c.drawString(72, 750, text)
        c.showPage()
    c.save()
    return buf.getvalue()


@pytest.fixture
def llm():
    return FakeLLM()


@pytest.fixture
def client(tmp_path, llm):
    settings = Settings(data_dir=str(tmp_path), secret_key="test-secret", max_upload_mb=1,
                        max_distance=0.7)
    app = create_app(settings, embedder=FakeEmbedder(), llm=llm)
    with TestClient(app) as c:
        yield c


def register(client, email="a@example.com", password="password123"):
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def auth(client):
    return register(client)


@pytest.fixture
def uploaded(client, auth):
    pdf = make_pdf([
        "Introduction to plants and gardening basics.",
        "Photosynthesis converts light energy into chemical energy inside chloroplasts.",
    ])
    r = client.post("/documents", headers=auth,
                    files={"file": ("plants.pdf", pdf, "application/pdf")})
    assert r.status_code == 201, r.text
    return r.json()
