from pathlib import Path

from app.services.quiz_loader import build_quiz_from_chapter


CHAPTER_DIR = (
    Path(__file__).resolve().parents[1]
    / "app"
    / "data"
    / "chapters"
    / "math-division-table"
)


def test_division_table_quiz_generates_ten_exact_timed_operations() -> None:
    quiz = build_quiz_from_chapter(CHAPTER_DIR)

    assert len(quiz.questions) == 10
    assert all(question.selection_type == "timed_division" for question in quiz.questions)
    assert all(3 <= question.divisor <= 9 for question in quiz.questions)
    assert all(3 <= question.quotient <= 9 for question in quiz.questions)
    assert all(question.dividend == question.divisor * question.quotient for question in quiz.questions)
    assert all(
        question.timed_division_config.time_limit_seconds == 10
        for question in quiz.questions
    )

    pairs = {(question.divisor, question.quotient) for question in quiz.questions}
    assert len(pairs) == len(quiz.questions)
