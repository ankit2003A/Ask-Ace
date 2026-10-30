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


# --- Google sign-in ---------------------------------------------------------
# The verifier itself is Google's RS256 signature check; these tests stand in
# for a verified token and cover what the route does with the result.
def fake_google(monkeypatch, sub="google-123", email="a@example.com"):
    from app.routers import auth as auth_router

    monkeypatch.setattr(auth_router, "verify_google_token", lambda credential, client_id: (sub, email))


def google_client(tmp_path, llm, client_id="test-client.apps.googleusercontent.com"):
    from fastapi.testclient import TestClient

    from app.config import Settings
    from app.main import create_app
    from tests.conftest import FakeEmbedder

    settings = Settings(_env_file=None, data_dir=str(tmp_path / "google"), secret_key="test-secret",
                        google_client_id=client_id)
    return TestClient(create_app(settings, embedder=FakeEmbedder(), llm=llm))


def test_config_reports_whether_google_is_on(client, tmp_path, llm):
    assert client.get("/auth/config").json()["google_client_id"] == ""
    with google_client(tmp_path, llm) as c:
        assert c.get("/auth/config").json()["google_client_id"].endswith(".googleusercontent.com")


def test_google_is_rejected_when_not_configured(client):
    assert client.post("/auth/google", json={"credential": "x.y.z"}).status_code == 503


def test_google_creates_an_account_then_reuses_it(tmp_path, llm, monkeypatch):
    fake_google(monkeypatch, email="new@example.com")
    with google_client(tmp_path, llm) as c:
        first = c.post("/auth/google", json={"credential": "x.y.z"})
        assert first.status_code == 200 and first.json()["token_type"] == "bearer"
        # Signing in again must not make a second account.
        assert c.post("/auth/google", json={"credential": "x.y.z"}).status_code == 200
        with c.app.state.db.session() as db:
            rows = db.execute("SELECT password_hash, google_sub FROM users").fetchall()
    assert len(rows) == 1
    # No password was set, and an empty hash can never match one.
    assert rows[0]["password_hash"] == "" and rows[0]["google_sub"] == "google-123"


def test_google_links_an_existing_password_account_and_drops_its_password(tmp_path, llm, monkeypatch):
    # Registration never checks the address, so this password may be an
    # attacker's who signed up first, waiting for the owner to arrive via Google.
    fake_google(monkeypatch, email="a@example.com")
    with google_client(tmp_path, llm) as c:
        register(c)
        assert c.post("/auth/google", json={"credential": "x.y.z"}).status_code == 200
        login = c.post("/auth/login", json={"email": "a@example.com", "password": "password123"})
        with c.app.state.db.session() as db:
            rows = db.execute("SELECT password_hash, google_sub FROM users").fetchall()
    assert len(rows) == 1
    assert rows[0]["password_hash"] == "" and rows[0]["google_sub"] == "google-123"
    assert login.status_code == 401


def test_google_matches_on_account_id_even_if_the_email_changed(tmp_path, llm, monkeypatch):
    with google_client(tmp_path, llm) as c:
        fake_google(monkeypatch, sub="google-123", email="old@example.com")
        first = c.post("/auth/google", json={"credential": "x.y.z"})
        fake_google(monkeypatch, sub="google-123", email="new@example.com")
        again = c.post("/auth/google", json={"credential": "x.y.z"})
        with c.app.state.db.session() as db:
            count = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    assert first.status_code == again.status_code == 200
    assert count == 1


def test_google_refuses_an_email_owned_by_another_google_account(tmp_path, llm, monkeypatch):
    with google_client(tmp_path, llm) as c:
        fake_google(monkeypatch, sub="google-123", email="a@example.com")
        assert c.post("/auth/google", json={"credential": "x.y.z"}).status_code == 200
        fake_google(monkeypatch, sub="google-999", email="a@example.com")
        assert c.post("/auth/google", json={"credential": "x.y.z"}).status_code == 409


def test_google_rejects_a_token_that_does_not_verify(tmp_path, llm, monkeypatch):
    from app.routers import auth as auth_router
    from app.security import GoogleTokenError

    def boom(credential, client_id):
        raise GoogleTokenError("Could not verify that Google sign-in.")

    monkeypatch.setattr(auth_router, "verify_google_token", boom)
    with google_client(tmp_path, llm) as c:
        assert c.post("/auth/google", json={"credential": "x.y.z"}).status_code == 401


# The verifier's own claim checks, against a token we sign ourselves and a
# stand-in for Google's key endpoint. Real tokens differ only in who holds
# the key, so everything below the signature is exercised for real.
def signed_google_token(claims, kid="k1"):
    import jwt
    from cryptography.hazmat.primitives.asymmetric import rsa

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = jwt.encode(claims, key, algorithm="RS256", headers={"kid": kid})
    return token, key.public_key()


def use_key(monkeypatch, public_key):
    """Point the verifier at our key instead of fetching Google's."""
    from app import security

    class Keys:
        def get_signing_key_from_jwt(self, token):
            return type("K", (), {"key": public_key})()

    monkeypatch.setattr(security, "_google_keys", Keys())


def google_claims(**over):
    import time

    base = {
        "iss": "https://accounts.google.com",
        "aud": "test-client.apps.googleusercontent.com",
        "sub": "google-123",
        "email": "Person@Example.com",
        "email_verified": True,
        "exp": int(time.time()) + 600,
    }
    return base | over


def test_verifier_accepts_a_good_token_and_normalises_the_email(monkeypatch):
    from app.security import verify_google_token

    token, pub = signed_google_token(google_claims())
    use_key(monkeypatch, pub)
    assert verify_google_token(token, "test-client.apps.googleusercontent.com") == (
        "google-123", "person@example.com",
    )


def test_verifier_rejects_bad_tokens(monkeypatch):
    import time

    import pytest

    from app.security import GoogleTokenError, verify_google_token

    audience = "test-client.apps.googleusercontent.com"
    cases = [
        google_claims(aud="someone-else.apps.googleusercontent.com"),  # another app's token
        google_claims(iss="https://evil.example.com"),                 # not Google
        google_claims(exp=int(time.time()) - 60),                      # expired
        google_claims(email_verified=False),                           # unconfirmed address
        google_claims(email=""),                                       # no address at all
    ]
    for claims in cases:
        token, pub = signed_google_token(claims)
        use_key(monkeypatch, pub)
        with pytest.raises(GoogleTokenError):
            verify_google_token(token, audience)
