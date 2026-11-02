"""Password hashing (bcrypt) and JWT helpers."""
from datetime import datetime, timedelta, timezone

import bcrypt
import httpx
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


# --- GitHub Sign-In ---------------------------------------------------------
# GitHub has no ID token: the browser brings back a one-time code, which only
# the server can trade for an access token (it needs the client secret), and
# the token then reads who signed in.
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API = "https://api.github.com"


class GitHubAuthError(Exception):
    """The code from the browser did not lead to a usable GitHub identity."""


def github_identity(code: str, client_id: str, client_secret: str) -> tuple[str, str]:
    """Return (GitHub account id, primary verified email) for a sign-in code."""
    try:
        with httpx.Client(timeout=10, headers={"Accept": "application/json"}) as http:
            r = http.post(GITHUB_TOKEN_URL, data={
                "client_id": client_id, "client_secret": client_secret, "code": code,
            })
            token = r.json().get("access_token") if r.status_code == 200 else None
            if not token:
                raise GitHubAuthError("Could not verify that GitHub sign-in.")
            auth = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
            user = http.get(f"{GITHUB_API}/user", headers=auth)
            emails = http.get(f"{GITHUB_API}/user/emails", headers=auth)
            user.raise_for_status()
            emails.raise_for_status()
            account_id, addresses = user.json()["id"], emails.json()
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise GitHubAuthError("Could not verify that GitHub sign-in.") from exc

    # Only the address GitHub has verified and marked primary: an unverified
    # one could belong to someone else, and signing in with it would hand
    # over their account.
    email = next(
        (str(e.get("email", "")).strip().lower() for e in addresses
         if isinstance(e, dict) and e.get("primary") and e.get("verified")),
        "",
    )
    if not email:
        raise GitHubAuthError("That GitHub account has no verified primary email address.")
    return str(account_id), email
