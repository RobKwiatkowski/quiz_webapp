"""Answer normalization and point helpers shared by backend tests."""

from __future__ import annotations

import re
import unicodedata


def normalize_answer(value: str) -> str:
    """Normalizes short open-answer text the same way as the quiz frontend."""
    normalized = re.sub(r"\s+", " ", value.strip()).lower()
    normalized = re.sub(r"[^\w]+$", "", normalized, flags=re.UNICODE)
    return "".join(
        char
        for char in unicodedata.normalize("NFKD", normalized)
        if not unicodedata.combining(char)
    )


def score_open_answer_slots(
    user_answers: list[str],
    answer_slots: list[dict[str, list[str]]],
) -> int:
    """Scores multi-slot open answers without depending on answer order."""
    unmatched_slots = [
        [normalize_answer(answer) for answer in slot.get("accepted_answers", [])]
        for slot in answer_slots
    ]
    points = 0

    for user_answer in [normalize_answer(answer) for answer in user_answers if answer.strip()]:
        for index, accepted_answers in enumerate(unmatched_slots):
            if user_answer in accepted_answers:
                points += 1
                unmatched_slots.pop(index)
                break

    return points
