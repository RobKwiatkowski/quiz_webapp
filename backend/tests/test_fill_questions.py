"""Tests for fill-in-the-blanks question validation."""

from app.services.quiz_validation import ValidationResult, validate_fill_blanks_structure


def test_select_fill_question_accepts_matching_tokens_and_options():
    result = ValidationResult()

    validate_fill_blanks_structure(
        "Ameryka Północna leży na {{direction}} od Europy.",
        "select",
        [
            {
                "id": "direction",
                "accepted_answers": ["zachód"],
                "options": ["zachód", "wschód", "północ", "południe"],
            }
        ],
        result,
        "test question",
    )

    assert result.errors == []


def test_fill_question_rejects_tokens_in_a_different_order_than_blanks():
    result = ValidationResult()

    validate_fill_blanks_structure(
        "Kontynentem jest {{continent}}, a kierunkiem {{direction}}.",
        "open",
        [
            {"id": "direction", "accepted_answers": ["zachód"]},
            {"id": "continent", "accepted_answers": ["Antarktyda"]},
        ],
        result,
        "test question",
    )

    assert any("text tokens" in error for error in result.errors)
