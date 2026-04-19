from fastapi import APIRouter

router = APIRouter(prefix="/api/quizzes", tags=["quizzes"])


@router.get("")
def get_quizzes():
    return [
        {
            "id": "history-poland-basics",
            "title": "Historia Polski — podstawy",
            "description": "Krótki quiz powtórkowy z historii dla dzieci.",
            "category": "history",
            "age_group": "10-12",
        }
    ]


@router.get("/{quiz_id}")
def get_quiz(quiz_id: str):
    return {
        "id": quiz_id,
        "title": "Historia Polski — podstawy",
        "description": "Krótki quiz powtórkowy z historii dla dzieci.",
        "category": "history",
        "age_group": "10-12",
        "questions": []
    }