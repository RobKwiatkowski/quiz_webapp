from pathlib import Path

import pytest
from pydantic import ValidationError

from app.models.quiz import TimedMultiplicationConfig
from app.services.quiz_loader import build_quiz_from_chapter


CHAPTER_DIR = (
    Path(__file__).resolve().parents[1]
    / "app"
    / "data"
    / "chapters"
    / "math-multiplication-table"
)


def test_multiplication_table_quiz_uses_factors_from_three_to_nine() -> None:
    quiz = build_quiz_from_chapter(CHAPTER_DIR)

    assert len(quiz.questions) == 10
    assert all(question.selection_type == "timed_multiplication" for question in quiz.questions)
    assert all(3 <= question.multiplicand <= 9 for question in quiz.questions)
    assert all(3 <= question.multiplier <= 9 for question in quiz.questions)
    assert all(
        question.timed_multiplication_config.time_limit_seconds == 5
        for question in quiz.questions
    )

    normalized_pairs = {
        tuple(sorted((question.multiplicand, question.multiplier)))
        for question in quiz.questions
    }
    assert len(normalized_pairs) == len(quiz.questions)


@pytest.mark.parametrize("factor", [1, 2, 10])
def test_timed_multiplication_config_rejects_excluded_factors(factor: int) -> None:
    with pytest.raises(ValidationError):
        TimedMultiplicationConfig(min_factor=factor, max_factor=factor)
