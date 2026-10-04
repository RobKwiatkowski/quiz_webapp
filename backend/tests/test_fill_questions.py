"""Tests for fill-in-the-blanks question validation."""

from pathlib import Path

from app.services.quiz_validation import (
    ValidationResult,
    validate_fill_blanks_structure,
    validate_question,
)


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


def listening_question() -> dict:
    return {
        "id": "listening-1",
        "text": "My sister has {{length}} {{colour}} hair.",
        "selection_type": "listening_fill",
        "audio": "/static/audio/example.wav",
        "spoken_text": "My sister has long blonde hair.",
        "fill_mode": "open",
        "fill_blanks": [
            {"id": "length", "accepted_answers": ["long"], "options": []},
            {"id": "colour", "accepted_answers": ["blonde"], "options": []},
        ],
        "explanation": "My sister has long blonde hair.",
    }


def validate_listening_question(question: dict, static_dir: Path) -> ValidationResult:
    result = ValidationResult()
    validate_question(
        question,
        result,
        set(),
        set(),
        "listening topic",
        static_dir,
    )
    return result


def test_listening_fill_accepts_two_open_blanks_and_existing_audio(tmp_path: Path):
    audio = tmp_path / "audio" / "example.wav"
    audio.parent.mkdir()
    audio.write_bytes(b"RIFF")

    result = validate_listening_question(listening_question(), tmp_path)

    assert result.errors == []


def test_listening_fill_rejects_more_than_two_blanks(tmp_path: Path):
    audio = tmp_path / "audio" / "example.wav"
    audio.parent.mkdir()
    audio.write_bytes(b"RIFF")
    question = listening_question()
    question["text"] += " {{extra}}"
    question["fill_blanks"].append(
        {"id": "extra", "accepted_answers": ["today"], "options": []}
    )

    result = validate_listening_question(question, tmp_path)

    assert any("exactly 2 blanks" in error for error in result.errors)
