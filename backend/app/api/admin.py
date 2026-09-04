"""Admin API for lightweight JSON-backed question editing."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse, Response
from pydantic import BaseModel

from app.config import settings
from app.services.admin_auth import (
    clear_session_cookie,
    require_admin,
    set_session_cookie,
    verify_password,
    verify_session_value,
)
from app.services.admin_content import (
    create_chapter,
    create_question,
    create_topic,
    delete_question,
    list_admin_chapters,
    list_admin_questions,
    list_admin_topics,
    update_question,
)

ADMIN_STATIC_DIR = Path(__file__).resolve().parents[1] / "admin_static"

router = APIRouter(prefix="/api/admin", tags=["admin"])
admin_pages_router = APIRouter(tags=["admin-pages"])


class LoginRequest(BaseModel):
    """Admin login request payload."""

    username: str
    password: str


class NameRequest(BaseModel):
    """Request payload for creating a named admin resource."""

    name: str


@admin_pages_router.get("/admin")
@admin_pages_router.get("/admin/")
def admin_index(request: Request):
    """Serves the admin page or redirects to login when unauthenticated."""
    if not verify_session_value(request.cookies.get("edu_quiz_admin")):
        return RedirectResponse("/admin/login.html", status_code=303)
    return FileResponse(ADMIN_STATIC_DIR / "index.html")


@admin_pages_router.get("/admin/login.html")
def admin_login_page(request: Request):
    """Serves the admin login page."""
    if verify_session_value(request.cookies.get("edu_quiz_admin")):
        return RedirectResponse("/admin/", status_code=303)
    return FileResponse(ADMIN_STATIC_DIR / "login.html")


@router.post("/login")
def login(payload: LoginRequest, response: Response):
    """Authenticates the configured single admin user."""
    if not settings.admin_username or not settings.admin_password_hash:
        raise HTTPException(status_code=503, detail="Admin login is not configured")

    if payload.username != settings.admin_username:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not verify_password(payload.password, settings.admin_password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    set_session_cookie(response, payload.username)
    return {"status": "ok"}


@router.post("/logout")
def logout(response: Response):
    """Clears the current admin session."""
    clear_session_cookie(response)
    return {"status": "ok"}


@router.get("/me")
def get_me(request: Request):
    """Returns whether the current request has a valid admin session."""
    return {"authenticated": verify_session_value(request.cookies.get("edu_quiz_admin"))}


@router.get("/chapters", dependencies=[Depends(require_admin)])
def get_chapters():
    """Lists chapters available for admin editing."""
    return list_admin_chapters()


@router.post("/chapters", dependencies=[Depends(require_admin)])
def post_chapter(payload: NameRequest):
    """Creates a new empty chapter."""
    return create_chapter(payload.model_dump())


@router.get("/chapters/{chapter_id}/topics", dependencies=[Depends(require_admin)])
def get_topics(chapter_id: str):
    """Lists topics for one chapter."""
    return list_admin_topics(chapter_id)


@router.post("/chapters/{chapter_id}/topics", dependencies=[Depends(require_admin)])
def post_topic(chapter_id: str, payload: NameRequest):
    """Creates a new empty topic inside one chapter."""
    return create_topic(chapter_id, payload.model_dump())


@router.get(
    "/chapters/{chapter_id}/topics/{topic_id}/questions",
    dependencies=[Depends(require_admin)],
)
def get_questions(chapter_id: str, topic_id: str):
    """Lists questions for one topic."""
    return list_admin_questions(chapter_id, topic_id)


@router.post(
    "/chapters/{chapter_id}/topics/{topic_id}/questions",
    dependencies=[Depends(require_admin)],
)
def post_question(chapter_id: str, topic_id: str, payload: dict[str, Any]):
    """Creates a question in one topic."""
    return create_question(chapter_id, topic_id, payload)


@router.put(
    "/chapters/{chapter_id}/topics/{topic_id}/questions/{question_id}",
    dependencies=[Depends(require_admin)],
)
def put_question(
    chapter_id: str,
    topic_id: str,
    question_id: str,
    payload: dict[str, Any],
):
    """Updates one question in one topic."""
    return update_question(chapter_id, topic_id, question_id, payload)


@router.delete(
    "/chapters/{chapter_id}/topics/{topic_id}/questions/{question_id}",
    dependencies=[Depends(require_admin)],
)
def remove_question(chapter_id: str, topic_id: str, question_id: str):
    """Deletes one question from one topic."""
    return delete_question(chapter_id, topic_id, question_id)
