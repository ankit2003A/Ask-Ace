import sqlite3

from fastapi import APIRouter, HTTPException, Request, status

from app.schemas import AuthConfigOut, Credentials, GoogleCredential, TokenOut
from app.security import (
    GoogleTokenError,
    create_token,
    hash_password,
    verify_google_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: Credentials, request: Request):
    state = request.app.state
    try:
        with state.db.session() as c:
            cur = c.execute(
                "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                (body.email, hash_password(body.password)),
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

    The client ID is public (it ships in every Google button on the web), and
    serving it at runtime means the same build works locally and in
    production, and turning Google sign-in on is an environment variable
    rather than a rebuild.
    """
    return AuthConfigOut(google_client_id=request.app.state.settings.google_client_id)


@router.post("/google", response_model=TokenOut)
def google(body: GoogleCredential, request: Request):
    """Exchange a Google ID token for one of ours.

    First sign-in creates the account. An address that already has a password
    account is the same person — Google has verified it — so that account gets
    linked rather than duplicated, and either way in still works afterwards.
    """
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

    with state.db.session() as c:
        row = c.execute(
            "SELECT id, google_sub FROM users WHERE google_sub = ? OR email = ?",
            (google_sub, email),
        ).fetchone()
        if row is None:
            cur = c.execute(
                "INSERT INTO users (email, password_hash, google_sub) VALUES (?, '', ?)",
                (email, google_sub),
            )
            user_id = cur.lastrowid
        else:
            user_id = row["id"]
            if row["google_sub"] is None:
                c.execute("UPDATE users SET google_sub = ? WHERE id = ?", (google_sub, user_id))

    token = create_token(user_id, state.settings.secret_key, state.settings.access_token_minutes)
    return TokenOut(access_token=token)
