"""Math API routes used by the experimental LLM-generated task flow."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/math", tags=["math"])


@router.get("/question")
def get_math_question():
    """Returns a placeholder math question until the LLM service is connected."""
    return {
        "id": "dummy-math-question-1",
        "title": "Zadanie z matematyki",
        "text": "Oblicz: 7 + 5.",
        "instruction": "Wpisz odpowiedź pełnym zdaniem albo sam wynik.",
    }
