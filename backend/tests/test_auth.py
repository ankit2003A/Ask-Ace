from tests.conftest import register


def test_register_and_login(client):
    register(client)
    r = client.post("/auth/login", json={"email": "a@example.com", "password": "password123!"})
    assert r.status_code == 200
    assert r.json()["token_type"] == "bearer"


def test_email_is_case_insensitive(client):
    register(client, "Mixed@Example.com")
    r = client.post("/auth/login", json={"email": "mixed@example.com", "password": "password123!"})
    assert r.status_code == 200


def test_duplicate_email_rejected(client):
    register(client)
    r = client.post("/auth/register", json={"email": "a@example.com", "password": "password123!"})
    assert r.status_code == 409


def test_wrong_password_and_unknown_user_get_same_error(client):
    register(client)
    bad_pw = client.post("/auth/login", json={"email": "a@example.com", "password": "wrongpass1"})
    unknown = client.post("/auth/login", json={"email": "x@example.com", "password": "password123!"})
    assert bad_pw.status_code == unknown.status_code == 401
    assert bad_pw.json() == unknown.json()


def test_validation_errors(client):
    assert client.post("/auth/register", json={"email": "nope", "password": "password123!"}).status_code == 422
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
    assert "password123!" not in stored and stored.startswith("$2")


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
        login = c.post("/auth/login", json={"email": "a@example.com", "password": "password123!"})
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


# --- Sign-up rules ----------------------------------------------------------
def test_register_stores_the_name(client):
    r = client.post("/auth/register", json={"email": "n@example.com", "password": "password123!",
                                             "name": "  Ada   Lovelace "})
    assert r.status_code == 201
    with client.app.state.db.session() as c:
        assert c.execute("SELECT name FROM users").fetchone()[0] == "Ada Lovelace"


def test_register_needs_a_number_and_a_special_character(client):
    for weak in ["password!!", "password12"]:
        r = client.post("/auth/register", json={"email": "w@example.com", "password": weak})
        assert r.status_code == 422, weak


def test_older_passwords_still_log_in(client):
    # Accounts made before the stronger rule keep working.
    from app.security import hash_password

    with client.app.state.db.session() as c:
        c.execute("INSERT INTO users (email, password_hash) VALUES (?, ?)",
                  ("old@example.com", hash_password("plainpassword")))
    r = client.post("/auth/login", json={"email": "old@example.com", "password": "plainpassword"})
    assert r.status_code == 200


# --- GitHub sign-in ---------------------------------------------------------
def github_client(tmp_path, llm, secret="gh-secret"):
    from fastapi.testclient import TestClient

    from app.config import Settings
    from app.main import create_app
    from tests.conftest import FakeEmbedder

    settings = Settings(_env_file=None, data_dir=str(tmp_path / "github"), secret_key="test-secret",
                        github_client_id="gh-client", github_client_secret=secret)
    return TestClient(create_app(settings, embedder=FakeEmbedder(), llm=llm))


def fake_github(monkeypatch, account="4242", email="a@example.com"):
    from app.routers import auth as auth_router

    monkeypatch.setattr(auth_router, "github_identity", lambda code, cid, secret: (account, email))


def test_github_config_needs_both_id_and_secret(client, tmp_path, llm):
    assert client.get("/auth/config").json()["github_client_id"] == ""
    with github_client(tmp_path, llm) as c:
        assert c.get("/auth/config").json()["github_client_id"] == "gh-client"
    with github_client(tmp_path, llm, secret="") as c:
        assert c.get("/auth/config").json()["github_client_id"] == ""
        assert c.post("/auth/github", json={"code": "abc"}).status_code == 503


def test_github_creates_then_reuses_an_account(tmp_path, llm, monkeypatch):
    fake_github(monkeypatch, email="gh@example.com")
    with github_client(tmp_path, llm) as c:
        assert c.post("/auth/github", json={"code": "abc"}).status_code == 200
        assert c.post("/auth/github", json={"code": "def"}).status_code == 200
        with c.app.state.db.session() as db:
            rows = db.execute("SELECT github_id, password_hash FROM users").fetchall()
    assert len(rows) == 1 and rows[0]["github_id"] == "4242" and rows[0]["password_hash"] == ""


def test_github_links_a_password_account_and_drops_its_password(tmp_path, llm, monkeypatch):
    fake_github(monkeypatch, email="a@example.com")
    with github_client(tmp_path, llm) as c:
        register(c)
        assert c.post("/auth/github", json={"code": "abc"}).status_code == 200
        login = c.post("/auth/login", json={"email": "a@example.com", "password": "password123!"})
    assert login.status_code == 401


def test_github_refuses_an_email_owned_by_another_github_account(tmp_path, llm, monkeypatch):
    with github_client(tmp_path, llm) as c:
        fake_github(monkeypatch, account="1", email="a@example.com")
        assert c.post("/auth/github", json={"code": "abc"}).status_code == 200
        fake_github(monkeypatch, account="2", email="a@example.com")
        assert c.post("/auth/github", json={"code": "abc"}).status_code == 409


def test_github_rejects_a_code_that_does_not_verify(tmp_path, llm, monkeypatch):
    from app.routers import auth as auth_router
    from app.security import GitHubAuthError

    def boom(code, cid, secret):
        raise GitHubAuthError("Could not verify that GitHub sign-in.")

    monkeypatch.setattr(auth_router, "github_identity", boom)
    with github_client(tmp_path, llm) as c:
        assert c.post("/auth/github", json={"code": "abc"}).status_code == 401


# github_identity itself, against a stand-in for GitHub's three endpoints.
# The real client, kept before any test swaps it, so swaps never stack.
_REAL_HTTPX_CLIENT = __import__("httpx").Client


def use_github(monkeypatch, token="t0k", emails=None):
    import httpx

    from app import security

    emails = emails if emails is not None else [
        {"email": "Other@Example.com", "primary": False, "verified": True},
        {"email": "Me@Example.com", "primary": True, "verified": True},
    ]

    def handler(request):
        if request.url.path == "/login/oauth/access_token":
            return httpx.Response(200, json={"access_token": token} if token else {"error": "bad_code"})
        assert request.headers["Authorization"] == f"Bearer {token}"
        if request.url.path == "/user":
            return httpx.Response(200, json={"id": 4242})
        return httpx.Response(200, json=emails)

    monkeypatch.setattr(security.httpx, "Client",
                        lambda **kw: _REAL_HTTPX_CLIENT(transport=httpx.MockTransport(handler), **kw))


def test_github_identity_uses_the_primary_verified_email(monkeypatch):
    from app.security import github_identity

    use_github(monkeypatch)
    assert github_identity("code", "id", "secret") == ("4242", "me@example.com")


def test_github_identity_rejects_bad_codes_and_unverified_addresses(monkeypatch):
    import pytest

    from app.security import GitHubAuthError, github_identity

    use_github(monkeypatch, token="")
    with pytest.raises(GitHubAuthError):
        github_identity("code", "id", "secret")

    use_github(monkeypatch, emails=[{"email": "me@example.com", "primary": True, "verified": False}])
    with pytest.raises(GitHubAuthError):
        github_identity("code", "id", "secret")
