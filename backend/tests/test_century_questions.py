from unittest.mock import patch

from app.models.quiz import CenturyConfig, Question
from app.services.quiz_loader import calculate_century, resolve_century_question


def test_calculate_century_uses_the_same_boundaries_for_bce_and_ce() -> None:
    assert calculate_century(1) == 1
    assert calculate_century(100) == 1
    assert calculate_century(101) == 2
    assert calculate_century(-400) == 4
    assert calculate_century(-457) == 5


def test_century_question_skips_year_zero_and_exposes_the_correct_answer() -> None:
    question = Question(
        id="century-test",
        text="Placeholder",
        explanation="Placeholder",
        selection_type="century",
        century_config=CenturyConfig(min_year=-1000, max_year=2000),
    )

    with patch("app.services.quiz_loader.random.randint", side_effect=[0, -457]):
        resolved = resolve_century_question(question)

    assert resolved.century_year == -457
    assert resolved.correct_century == 5
    assert resolved.text == "Rok 457 p.n.e. Zapisz liczb\u0105 rzymsk\u0105, kt\u00f3ry to wiek."
    assert resolved.explanation == "Rok 457 p.n.e. nale\u017cy do V wieku p.n.e."
