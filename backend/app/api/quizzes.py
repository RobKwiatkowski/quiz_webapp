"""Quiz API routes used by the frontend application."""

from typing import Literal

from fastapi import APIRouter, HTTPException
from app.services.quiz_loader import load_quiz_by_id, load_quiz_list

router = APIRouter(prefix="/api/quizzes", tags=["quizzes"])


@router.get("")
def get_quizzes():
    """Returns lightweight metadata for all available quizzes.

    Returns:
        list[QuizListItem]: Quiz list for the index page.
    """
    return load_quiz_list()


@router.get("/{quiz_id}")
def get_quiz(quiz_id: str, difficulty: Literal["easy", "medium", "pro", "hard"] = "easy"):
    """Returns a full quiz payload for a given quiz identifier.

    Args:
        quiz_id: Unique quiz identifier.

    Returns:
        Quiz: Full quiz payload with questions.

    Raises:
        HTTPException: If the requested quiz does not exist.
    """
    normalized_difficulty = "pro" if difficulty == "hard" else difficulty
    quiz = load_quiz_by_id(quiz_id, normalized_difficulty)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz
