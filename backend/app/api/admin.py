"""Admin API for lightweight JSON-backed question editing."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse, Response
from pydantic import BaseModel, Field

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
    delete_topic,
    list_admin_chapters,
    list_admin_images,
    list_admin_questions,
    list_admin_subjects,
    list_admin_topics,
    move_question,
    save_uploaded_chapter_image,
    update_chapter_number,
    update_topic_active,
    update_target_question_count,
    update_question,
    update_question_active,
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


class ChapterNumberRequest(BaseModel):
    """Optional number displayed in the chapter badge."""

    chapter_number: int | None = Field(default=None, ge=1)


class TargetQuestionCountRequest(BaseModel):
    """Requested number of questions randomly selected for a chapter quiz."""

    target_question_count: int = Field(ge=1)


class TopicActiveRequest(BaseModel):
    """Requested activation state for one topic."""

    is_active: bool


class QuestionActiveRequest(BaseModel):
    """Requested activation state for one question."""

    is_active: bool


class MoveQuestionRequest(BaseModel):
    """Target topic for moving one question within a chapter."""

    target_topic_id: str = Field(min_length=1)


class ImageUploadRequest(BaseModel):
    """Image file supplied by the browser as a base64 data URL."""

    filename: str = Field(min_length=1)
    content_base64: str = Field(min_length=1)


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


@router.get("/subjects", dependencies=[Depends(require_admin)])
def get_subjects():
    """Lists subjects available for admin editing."""
    return list_admin_subjects()


@router.get("/chapters", dependencies=[Depends(require_admin)])
def get_chapters(subject: str | None = None):
    """Lists chapters available for admin editing."""
    return list_admin_chapters(subject)


@router.post("/chapters", dependencies=[Depends(require_admin)])
def post_chapter(payload: NameRequest):
    """Creates a new empty chapter."""
    return create_chapter(payload.model_dump())


@router.put("/chapters/{chapter_id}/chapter-number", dependencies=[Depends(require_admin)])
def put_chapter_number(chapter_id: str, payload: ChapterNumberRequest):
    """Updates the optional chapter badge number."""
    return update_chapter_number(chapter_id, payload.chapter_number)


@router.put("/chapters/{chapter_id}/target-question-count", dependencies=[Depends(require_admin)])
def put_target_question_count(chapter_id: str, payload: TargetQuestionCountRequest):
    """Updates the number of questions randomly selected for a chapter quiz."""
    return update_target_question_count(chapter_id, payload.target_question_count)


@router.get("/chapters/{chapter_id}/topics", dependencies=[Depends(require_admin)])
def get_topics(chapter_id: str):
    """Lists topics for one chapter."""
    return list_admin_topics(chapter_id)


@router.get("/chapters/{chapter_id}/images", dependencies=[Depends(require_admin)])
def get_images(chapter_id: str):
    """Lists reusable images for the chapter's subject."""
    return list_admin_images(chapter_id)


@router.post("/chapters/{chapter_id}/images", dependencies=[Depends(require_admin)])
def post_image(chapter_id: str, payload: ImageUploadRequest):
    """Uploads an image immediately to the chapter's reusable image folder."""
    return {"path": save_uploaded_chapter_image(payload.model_dump(), chapter_id)}


@router.post("/chapters/{chapter_id}/topics", dependencies=[Depends(require_admin)])
def post_topic(chapter_id: str, payload: NameRequest):
    """Creates a new empty topic inside one chapter."""
    return create_topic(chapter_id, payload.model_dump())


@router.delete(
    "/chapters/{chapter_id}/topics/{topic_id}",
    dependencies=[Depends(require_admin)],
)
def remove_topic(chapter_id: str, topic_id: str):
    """Removes one topic from a chapter while preserving a recovery copy."""
    return delete_topic(chapter_id, topic_id)


@router.put(
    "/chapters/{chapter_id}/topics/{topic_id}/active",
    dependencies=[Depends(require_admin)],
)
def put_topic_active(chapter_id: str, topic_id: str, payload: TopicActiveRequest):
    """Activates or deactivates one topic."""
    return update_topic_active(chapter_id, topic_id, payload.is_active)


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
    "/chapters/{chapter_id}/topics/{topic_id}/questions/{question_id}/active",
    dependencies=[Depends(require_admin)],
)
def put_question_active(
    chapter_id: str,
    topic_id: str,
    question_id: str,
    payload: QuestionActiveRequest,
):
    """Activates or deactivates one question."""
    return update_question_active(
        chapter_id,
        topic_id,
        question_id,
        payload.is_active,
    )


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


@router.post(
    "/chapters/{chapter_id}/topics/{topic_id}/questions/{question_id}/move",
    dependencies=[Depends(require_admin)],
)
def post_move_question(
    chapter_id: str,
    topic_id: str,
    question_id: str,
    payload: MoveQuestionRequest,
):
    """Moves one question to another topic in the same chapter."""
    return move_question(
        chapter_id,
        topic_id,
        question_id,
        payload.target_topic_id,
    )


@router.delete(
    "/chapters/{chapter_id}/topics/{topic_id}/questions/{question_id}",
    dependencies=[Depends(require_admin)],
)
def remove_question(chapter_id: str, topic_id: str, question_id: str):
    """Deletes one question from one topic."""
    return delete_question(chapter_id, topic_id, question_id)
