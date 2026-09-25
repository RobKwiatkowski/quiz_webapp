from pathlib import Path

from app.models.quiz import Question, WrittenMultiplicationConfig
from app.services.quiz_loader import (
    build_quiz_from_chapter,
    calculate_division_intermediate_values,
    resolve_written_multiplication_question,
)


CHAPTER_DIR = (
    Path(__file__).resolve().parents[1]
    / "app"
    / "data"
    / "chapters"
    / "math-written-calculations"
)


def test_easy_written_division_limits_divisors_and_intermediate_values() -> None:
    for _ in range(20):
        quiz = build_quiz_from_chapter(CHAPTER_DIR, "easy")
        assert len(quiz.questions) == 3

        for question in quiz.questions:
            assert question.selection_type == "written_division"
            assert 3 <= question.divisor <= 10
            assert 10 <= question.quotient <= 999
            assert len(str(question.dividend)) <= 4
            values = calculate_division_intermediate_values(question.dividend, question.divisor)
            assert values
            assert max(values) <= 100


def test_medium_written_division_uses_medium_divisor_range() -> None:
    for _ in range(20):
        quiz = build_quiz_from_chapter(CHAPTER_DIR, "medium")

        for question in quiz.questions:
            assert question.selection_type == "written_division"
            assert 8 <= question.divisor <= 15
            assert 10 <= question.quotient <= 999
            assert len(str(question.dividend)) <= 4
            values = calculate_division_intermediate_values(question.dividend, question.divisor)
            assert values
            assert max(values) <= 100


def test_pro_written_division_keeps_full_configured_range() -> None:
    for _ in range(20):
        quiz = build_quiz_from_chapter(CHAPTER_DIR, "pro")

        for question in quiz.questions:
            assert question.selection_type == "written_division"
            assert 2 <= question.divisor <= 99
            assert 10 <= question.quotient <= 9999
            assert len(str(question.dividend)) <= 6


def test_easy_written_multiplication_limits_each_partial_product() -> None:
    question = Question(
        id="easy-multiplication",
        text="Oblicz sposobem pisemnym.",
        explanation="Sprawdź wynik.",
        selection_type="written_multiplication",
        written_multiplication_config=WrittenMultiplicationConfig(
            min_factor=10,
            max_factor=9999,
            max_total_digits=6,
            easy_max_total_digits=4,
            easy_max_partial_product=100,
        ),
    )

    resolved = resolve_written_multiplication_question(question, set(), "easy")

    assert len(str(resolved.multiplicand)) + len(str(resolved.multiplier)) <= 4
    assert max(
        resolved.multiplicand * int(digit)
        for digit in str(resolved.multiplier)
    ) <= 100
