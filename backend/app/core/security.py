from datetime import datetime, timedelta, timezone
from typing import Literal

import bcrypt
import jwt

from app.core.config import settings


# ---------- Password hashing ----------

def hash_password(plain_password: str) -> str:
    """Hash a plaintext password with bcrypt. Never store plaintext, ever."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a plaintext password against its bcrypt hash."""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


# ---------- JWT tokens ----------

def _create_token(subject: str, expires_delta: timedelta, token_type: Literal["access", "refresh"]) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,        # user id, as a string
        "type": token_type,    # lets us reject a refresh token used as an access token, and vice versa
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: int) -> str:
    return _create_token(
        subject=str(user_id),
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type="access",
    )


def create_refresh_token(user_id: int) -> str:
    return _create_token(
        subject=str(user_id),
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token_type="refresh",
    )


class TokenError(Exception):
    """Raised for any invalid/expired/wrong-type token. Caught in the API layer as a 401."""


def decode_token(token: str, expected_type: Literal["access", "refresh"]) -> int:
    """
    Decode and validate a JWT, returning the user id encoded in it.
    Raises TokenError if the token is invalid, expired, or the wrong type
    (e.g. someone tries to use a refresh token to call a protected endpoint).
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise TokenError("Token has expired")
    except jwt.InvalidTokenError:
        raise TokenError("Invalid token")

    if payload.get("type") != expected_type:
        raise TokenError(f"Expected a {expected_type} token")

    try:
        return int(payload["sub"])
    except (KeyError, ValueError):
        raise TokenError("Token missing valid subject")
