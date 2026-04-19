from fastapi import APIRouter, HTTPException
from app.services.quiz_loader import load_quiz_by_id, load_quiz_list

router = APIRouter(prefix="/api/quizzes", tags=["quizzes"])


@router.get("")
def get_quizzes():
    return load_quiz_list()


@router.get("/{quiz_id}")
def get_quiz(quiz_id: str):
    quiz = load_quiz_by_id(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz