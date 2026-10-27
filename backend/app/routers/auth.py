import sqlite3

from fastapi import APIRouter, HTTPException, Request, status

from app.schemas import Credentials, TokenOut
from app.security import create_token, hash_password, verify_password

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
