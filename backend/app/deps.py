from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.security import decode_token

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED, "Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorized
    user_id = decode_token(creds.credentials, request.app.state.settings.secret_key)
    if user_id is None:
        raise unauthorized
    with request.app.state.db.session() as c:
        row = c.execute("SELECT id, email FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise unauthorized
    return {"id": row["id"], "email": row["email"]}
