from tests.conftest import make_pdf, register


def test_upload_lists_and_counts(client, auth, uploaded):
    assert uploaded["pages"] == 2 and uploaded["chunks"] >= 2
    docs = client.get("/documents", headers=auth).json()
    assert [d["filename"] for d in docs] == ["plants.pdf"]


def test_rejects_non_pdf_extension(client, auth):
    r = client.post("/documents", headers=auth, files={"file": ("notes.txt", b"hello", "text/plain")})
    assert r.status_code == 415


def test_rejects_fake_pdf_content(client, auth):
    r = client.post("/documents", headers=auth, files={"file": ("x.pdf", b"not really a pdf", "application/pdf")})
    assert r.status_code == 422


def test_rejects_empty_file(client, auth):
    r = client.post("/documents", headers=auth, files={"file": ("x.pdf", b"", "application/pdf")})
    assert r.status_code == 422


def test_rejects_scanned_pdf_without_text(client, auth):
    r = client.post("/documents", headers=auth, files={"file": ("scan.pdf", make_pdf(["", ""]), "application/pdf")})
    assert r.status_code == 422
    assert "scanned" in r.json()["detail"].lower()


def test_rejects_oversized_file(client, auth):
    big = b"%PDF-1.4\n" + b"0" * (1024 * 1024 + 10)
    r = client.post("/documents", headers=auth, files={"file": ("big.pdf", big, "application/pdf")})
    assert r.status_code == 413


def test_path_in_filename_is_stripped(client, auth):
    r = client.post("/documents", headers=auth,
                    files={"file": ("../../etc/evil.pdf", make_pdf(["some text here"]), "application/pdf")})
    assert r.status_code == 201 and r.json()["filename"] == "evil.pdf"


def test_delete_document_removes_vectors(client, auth, uploaded):
    assert client.app.state.store.collection.count() > 0
    assert client.delete(f"/documents/{uploaded['id']}", headers=auth).status_code == 204
    assert client.app.state.store.collection.count() == 0
    assert client.get("/documents", headers=auth).json() == []


def test_users_cannot_see_or_delete_each_others_documents(client, auth, uploaded):
    other = register(client, "b@example.com")
    assert client.get("/documents", headers=other).json() == []
    assert client.delete(f"/documents/{uploaded['id']}", headers=other).status_code == 404
    r = client.post("/ask", headers=other, json={"question": "what is photosynthesis"})
    assert r.json()["sources"] == []


# --- streamed progress ------------------------------------------------------

import json  # noqa: E402

from tests.conftest import make_pdf  # noqa: E402


def stream_upload(client, auth, pdf, name="notes.pdf"):
    r = client.post("/documents?stream=true", headers=auth,
                    files={"file": (name, pdf, "application/pdf")})
    events = [json.loads(line) for line in r.text.splitlines() if line.strip()]
    return r, events


def test_streamed_upload_reports_real_progress_then_the_document(client, auth):
    pdf = make_pdf(["Cells divide by mitosis.", "Plants make food by photosynthesis.",
                    "Water moves through xylem."])
    r, events = stream_upload(client, auth, pdf)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/x-ndjson")

    stages = [e["stage"] for e in events]
    assert stages[-1] == "done"
    assert stages.index("reading") < stages.index("embedding") < stages.index("saving")

    reading = [e for e in events if e["stage"] == "reading"]
    assert [e["done"] for e in reading] == [1, 2, 3]  # every page, in order
    assert all(e["total"] == 3 for e in reading)

    embedding = [e for e in events if e["stage"] == "embedding"]
    assert embedding[0]["done"] == 0
    assert embedding[-1]["done"] == embedding[-1]["total"]  # finished, not abandoned
    done = [e["done"] for e in embedding]
    assert done == sorted(done)  # progress never goes backwards

    document = events[-1]["document"]
    assert document["pages"] == 3
    assert [d["id"] for d in client.get("/documents", headers=auth).json()] == [document["id"]]


def test_streamed_upload_of_a_textless_pdf_ends_in_an_error_and_saves_nothing(client, auth):
    r, events = stream_upload(client, auth, make_pdf(["", ""]), name="scan.pdf")
    assert r.status_code == 200  # the stream had already started
    assert events[-1]["stage"] == "error"
    assert events[-1]["status"] == 422
    assert "scanned" in events[-1]["detail"]
    assert client.get("/documents", headers=auth).json() == []


def test_streamed_upload_still_rejects_bad_files_with_a_status_code(client, auth):
    r = client.post("/documents?stream=true", headers=auth,
                    files={"file": ("notes.txt", b"hello", "text/plain")})
    assert r.status_code == 415


def test_streamed_upload_requires_authentication(client):
    r = client.post("/documents?stream=true",
                    files={"file": ("a.pdf", make_pdf(["x"]), "application/pdf")})
    assert r.status_code == 401
