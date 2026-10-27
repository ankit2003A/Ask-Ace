from tests.conftest import register


def test_register_and_login(client):
    register(client)
    r = client.post("/auth/login", json={"email": "a@example.com", "password": "password123"})
    assert r.status_code == 200
    assert r.json()["token_type"] == "bearer"


def test_email_is_case_insensitive(client):
    register(client, "Mixed@Example.com")
    r = client.post("/auth/login", json={"email": "mixed@example.com", "password": "password123"})
    assert r.status_code == 200


def test_duplicate_email_rejected(client):
    register(client)
    r = client.post("/auth/register", json={"email": "a@example.com", "password": "password123"})
    assert r.status_code == 409


def test_wrong_password_and_unknown_user_get_same_error(client):
    register(client)
    bad_pw = client.post("/auth/login", json={"email": "a@example.com", "password": "wrongpass1"})
    unknown = client.post("/auth/login", json={"email": "x@example.com", "password": "password123"})
    assert bad_pw.status_code == unknown.status_code == 401
    assert bad_pw.json() == unknown.json()


def test_validation_errors(client):
    assert client.post("/auth/register", json={"email": "nope", "password": "password123"}).status_code == 422
    assert client.post("/auth/register", json={"email": "a@b.co", "password": "short"}).status_code == 422
    assert client.post("/auth/register", json={"email": "a@b.co", "password": "x" * 80}).status_code == 422


def test_protected_routes_require_token(client):
    for method, path in [("get", "/documents"), ("get", "/history"), ("delete", "/documents/1")]:
        assert getattr(client, method)(path).status_code == 401
    assert client.post("/ask", json={"question": "hello there"}).status_code == 401
    r = client.get("/documents", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401


def test_password_is_not_stored_in_plaintext(client):
    register(client)
    with client.app.state.db.session() as c:
        stored = c.execute("SELECT password_hash FROM users").fetchone()[0]
    assert "password123" not in stored and stored.startswith("$2")
