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
