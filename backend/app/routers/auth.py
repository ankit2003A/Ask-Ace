import sqlite3

from fastapi import APIRouter, HTTPException, Request, status

from app.schemas import AuthConfigOut, Credentials, GitHubCode, GoogleCredential, RegisterIn, TokenOut
from app.security import (
    GitHubAuthError,
    GoogleTokenError,
    create_token,
    github_identity,
    hash_password,
    verify_google_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# The account-id column for each sign-in provider. Fixed strings, never user
# input, so they are safe to put into SQL.
PROVIDER_COLUMNS = {"Google": "google_sub", "GitHub": "github_id"}


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, request: Request):
    state = request.app.state
    try:
        with state.db.session() as c:
            cur = c.execute(
                "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
                (body.email, hash_password(body.password), body.name),
            )
            user_id = cur.lastrowid
    except sqlite3.IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email is already registered")
    token = create_token(user_id, state.settings.secret_key, state.settings.access_token_minutes)
    return TokenOut(access_token=token)


@router.post("/login", response_model=TokenOut)
def login(body: Credentials, request: Request):
    state = request.app.state
    with state.db.session() as c:
        row = c.execute(
            "SELECT id, password_hash FROM users WHERE email = ?", (body.email,)
        ).fetchone()
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    token = create_token(row["id"], state.settings.secret_key, state.settings.access_token_minutes)
    return TokenOut(access_token=token)


@router.get("/config", response_model=AuthConfigOut)
def config(request: Request):
    """What the sign-in screen needs before it draws itself.

    Both client IDs are public (they ship in the page either way), and serving
    them at runtime means the same build works locally and in production, and
    turning a provider on is an environment variable rather than a rebuild.
    """
    settings = request.app.state.settings
    return AuthConfigOut(
        google_client_id=settings.google_client_id,
        github_client_id=settings.github_client_id if settings.github_client_secret else "",
    )


@router.post("/google", response_model=TokenOut)
def google(body: GoogleCredential, request: Request):
    """Exchange a Google ID token for one of ours."""
    state = request.app.state
    client_id = state.settings.google_client_id
    if not client_id:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Google sign-in is not configured on this server."
        )
    try:
        google_sub, email = verify_google_token(body.credential, client_id)
    except GoogleTokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc))
    return _provider_sign_in(state, "Google", google_sub, email)


@router.post("/github", response_model=TokenOut)
def github(body: GitHubCode, request: Request):
    """Exchange the code GitHub sent back to the browser for one of our tokens."""
    state = request.app.state
    settings = state.settings
    if not (settings.github_client_id and settings.github_client_secret):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "GitHub sign-in is not configured on this server."
        )
    try:
        github_id, email = github_identity(body.code, settings.github_client_id,
                                           settings.github_client_secret)
    except GitHubAuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc))
    return _provider_sign_in(state, "GitHub", github_id, email)


def _provider_sign_in(state, provider: str, account_id: str, email: str) -> TokenOut:
    """Sign in with an identity a provider has verified, creating or linking.

    First sign-in creates the account. An address that already has a password
    account gets linked rather than duplicated, and loses its password: the
    provider has verified the address, but registration never did, so the
    password may belong to someone who signed up with this address before its
    owner did. Keeping it would let them back into the account the owner uses.
    """
    column = PROVIDER_COLUMNS[provider]
    with state.db.session() as c:
        # The provider's account id first: it never changes, while an address
        # can move to a different account.
        row = c.execute(f"SELECT id FROM users WHERE {column} = ?", (account_id,)).fetchone()
        if row is not None:
            user_id = row["id"]
        else:
            row = c.execute(f"SELECT id, {column} AS linked FROM users WHERE email = ?",
                            (email,)).fetchone()
            if row is None:
                cur = c.execute(
                    f"INSERT INTO users (email, password_hash, {column}) VALUES (?, '', ?)",
                    (email, account_id),
                )
                user_id = cur.lastrowid
            elif row["linked"] is not None:
                # Same address, different account at the provider: never merge silently.
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    f"This email is already linked to a different {provider} account.",
                )
            else:
                user_id = row["id"]
                c.execute(
                    f"UPDATE users SET {column} = ?, password_hash = '' WHERE id = ?",
                    (account_id, user_id),
                )

    token = create_token(user_id, state.settings.secret_key, state.settings.access_token_minutes)
    return TokenOut(access_token=token)
