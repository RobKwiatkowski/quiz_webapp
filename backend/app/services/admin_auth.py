"""Minimal signed-cookie authentication for the single admin user."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import time

from fastapi import HTTPException, Request
from fastapi.responses import Response

from app.config import settings

SESSION_COOKIE_NAME = "edu_quiz_admin"
SESSION_TTL_SECONDS = 60 * 60 * 12


def hash_password(password: str, iterations: int = 260000) -> str:
    """Creates a PBKDF2-SHA256 password hash string for admin setup."""
    try:
        from passlib.hash import pbkdf2_sha256

        return pbkdf2_sha256.hash(password)
    except ImportError:
        pass

    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return (
        f"pbkdf2_sha256${iterations}$"
        f"{base64.urlsafe_b64encode(salt).decode()}$"
        f"{base64.urlsafe_b64encode(digest).decode()}"
    )


def verify_password(password: str, password_hash: str) -> bool:
    """Checks a plaintext password against the configured PBKDF2 hash."""
    if password_hash.startswith("$pbkdf2-sha256$"):
        try:
            from passlib.hash import pbkdf2_sha256

            return bool(pbkdf2_sha256.verify(password, password_hash))
        except ImportError:
            return False

    try:
        algorithm, iterations_text, salt_text, digest_text = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_text)
        salt = base64.urlsafe_b64decode(salt_text.encode())
        expected_digest = base64.urlsafe_b64decode(digest_text.encode())
    except Exception:
        return False

    actual_digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return hmac.compare_digest(actual_digest, expected_digest)


def _sign(payload: str) -> str:
    key = settings.admin_password_hash.encode()
    return hmac.new(key, payload.encode(), hashlib.sha256).hexdigest()


def create_session_value(username: str) -> str:
    """Creates a signed session cookie value."""
    issued_at = str(int(time.time()))
    payload = f"{username}|{issued_at}"
    signature = _sign(payload)
    token = f"{payload}|{signature}".encode()
    return base64.urlsafe_b64encode(token).decode()


def verify_session_value(session_value: str | None) -> bool:
    """Returns whether a session cookie is present, valid, and not expired."""
    if not session_value or not settings.admin_username or not settings.admin_password_hash:
        return False

    try:
        decoded = base64.urlsafe_b64decode(session_value.encode()).decode()
        username, issued_at_text, signature = decoded.rsplit("|", 2)
        issued_at = int(issued_at_text)
    except Exception:
        return False

    payload = f"{username}|{issued_at}"
    if not hmac.compare_digest(_sign(payload), signature):
        return False

    if username != settings.admin_username:
        return False

    return time.time() - issued_at <= SESSION_TTL_SECONDS


def require_admin(request: Request) -> None:
    """FastAPI dependency that rejects unauthenticated admin requests."""
    if not verify_session_value(request.cookies.get(SESSION_COOKIE_NAME)):
        raise HTTPException(status_code=401, detail="Admin login required")


def set_session_cookie(response: Response, username: str) -> None:
    """Writes the signed session cookie to a response."""
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=create_session_value(username),
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="lax",
    )


def clear_session_cookie(response: Response) -> None:
    """Clears the signed session cookie."""
    response.delete_cookie(SESSION_COOKIE_NAME)
