"""Password hashing (bcrypt) and JWT helpers."""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_token(user_id: int, secret: str, minutes: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "iat": now, "exp": now + timedelta(minutes=minutes)}
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def decode_token(token: str, secret: str) -> int | None:
    """Return the user id, or None if the token is invalid or expired."""
    try:
        payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


# --- Google Sign-In ---------------------------------------------------------
# Verifying the ID token ourselves keeps the dependency list short: it is a
# normal RS256 JWT, signed by keys Google publishes at a fixed URL.
GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}

_google_keys: jwt.PyJWKClient | None = None


class GoogleTokenError(Exception):
    """The credential from the browser was not a valid Google ID token."""


def verify_google_token(credential: str, client_id: str) -> tuple[str, str]:
    """Return (google subject id, email) from a Google ID token.

    Raises GoogleTokenError for anything that does not verify: a bad
    signature, an expired token, one minted for a different client, or an
    address Google has not confirmed belongs to the account.
    """
    global _google_keys
    if _google_keys is None:
        # The client caches the keys, so this is one request per key rotation.
        _google_keys = jwt.PyJWKClient(GOOGLE_CERTS_URL, cache_keys=True)
    try:
        key = _google_keys.get_signing_key_from_jwt(credential).key
        claims = jwt.decode(
            credential, key, algorithms=["RS256"], audience=client_id,
            options={"require": ["exp", "aud", "iss", "sub"]},
        )
    except (jwt.PyJWTError, OSError) as exc:
        raise GoogleTokenError("Could not verify that Google sign-in.") from exc

    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise GoogleTokenError("Could not verify that Google sign-in.")
    email = str(claims.get("email", "")).strip().lower()
    # An unverified address could belong to someone else, and signing in with
    # it would hand over that person's account.
    if not email or claims.get("email_verified") is not True:
        raise GoogleTokenError("That Google account has no verified email address.")
    return str(claims["sub"]), email
