import json
import random
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.answer_check import normalize_answer
from app.services.quiz_loader import build_quiz_from_chapter


CHAPTER_DIR = (
    Path(__file__).resolve().parents[1]
    / "app"
    / "data"
    / "chapters"
    / "english-past-simple"
)

EXPECTED_VERBS = {
    "be", "go", "have", "do", "say", "see", "come", "get", "make", "know",
    "think", "take", "give", "find", "tell", "become", "leave", "feel", "put",
    "bring", "begin", "keep", "hold", "write", "stand", "hear", "let", "mean",
    "meet", "run", "play", "watch", "work", "live", "like", "want", "need",
    "help", "call", "ask", "open", "close", "visit", "clean", "cook", "study",
    "try", "carry", "stop", "travel", "buy", "eat",
}

IRREGULAR_VERBS = {
    "be", "go", "have", "do", "say", "see", "come", "get", "make", "know",
    "think", "take", "give", "find", "tell", "become", "leave", "feel", "put",
    "bring", "begin", "keep", "hold", "write", "stand", "hear", "let", "mean",
    "meet", "run",
}


def load_content() -> tuple[dict, list[dict]]:
    meta = json.loads((CHAPTER_DIR / "meta.json").read_text(encoding="utf-8"))
    topics = [
        json.loads((CHAPTER_DIR / filename).read_text(encoding="utf-8"))
        for filename in meta["topics"]
    ]
    return meta, topics


def test_past_simple_content_has_requested_structure_and_all_verbs():
    meta, topics = load_content()

    assert meta["category"] == "english"
    assert meta["target_question_count"] == 20
    assert [topic["topic_title"] for topic in topics] == [
        "Formy czasowników",
        "Przeczenia",
        "Pytania",
        "Wybór poprawnej formy",
        "Tłumaczenie pełnych zdań",
    ]
    assert [len(topic["questions"]) for topic in topics] == [39, 15, 15, 1, 10]

    questions = [question for topic in topics for question in topic["questions"]]
    question_ids = [question["id"] for question in questions]
    assert len(questions) == 80
    assert len(question_ids) == len(set(question_ids))
    assert {question_id.rsplit("-", 1)[-1] for question_id in question_ids} == EXPECTED_VERBS
    assert all(
        question["selection_type"] == "llm"
        for question in topics[-1]["questions"]
    )
    assert all(
        question["selection_type"] != "llm"
        for topic in topics[:-1]
        for question in topic["questions"]
    )

    extra_question_ids = [question_id for question_id in question_ids if "-extra-" in question_id]
    assert len(extra_question_ids) == 20
    assert all(
        question_id.rsplit("-", 1)[-1] in IRREGULAR_VERBS
        for question_id in extra_question_ids
    )


def test_past_simple_open_answers_keep_whole_constructions():
    _meta, topics = load_content()
    forms, negatives, questions, choices, translations = topics

    assert all(question["selection_type"] == "open" for question in forms["questions"])
    assert all(question["selection_type"] == "open" for question in negatives["questions"])
    assert all(question["selection_type"] == "open" for question in questions["questions"])
    assert all(question["selection_type"] == "single" for question in choices["questions"])

    be_question = next(question for question in negatives["questions"] if question["id"] == "ps-negative-be")
    assert be_question["accepted_answers"] == ["weren't", "were not"]

    for question in negatives["questions"]:
        accepted = question["accepted_answers"]
        if question["id"] == "ps-negative-be":
            continue
        assert len(accepted) == 2
        assert accepted[0].startswith("didn't ")
        assert accepted[1].startswith("did not ")

    assert all(
        question["accepted_answers"] == [question["accepted_answers"][0]]
        and question["accepted_answers"][0].startswith("Did ")
        for question in questions["questions"]
    )

    assert len(choices["questions"]) == 1
    choice = choices["questions"][0]
    assert len(choice["answers"]) == 4
    assert sum(answer["is_correct"] for answer in choice["answers"]) == 1

    assert len(translations["questions"]) == 10
    assert translations["max_questions_per_quiz"] == 2
    assert all(question["selection_type"] == "llm" for question in translations["questions"])
    assert all(len(question["accepted_answers"]) == 1 for question in translations["questions"])
    assert all(
        len(question["accepted_answers"][0].rstrip(".").split()) >= 6
        for question in translations["questions"]
    )


def test_past_simple_answer_normalization_is_deterministic():
    assert normalize_answer("  DID   TOM PLAY? ") == "did tom play"
    assert normalize_answer("didn't   play.") == "didn't play"
    assert normalize_answer("  WAS NOT.  ") == "was not"


def test_past_simple_attempt_contains_twenty_unique_questions_and_is_reshuffled():
    random.seed(101)
    first_attempt = build_quiz_from_chapter(CHAPTER_DIR)
    random.seed(202)
    second_attempt = build_quiz_from_chapter(CHAPTER_DIR)

    first_ids = [question.id for question in first_attempt.questions]
    second_ids = [question.id for question in second_attempt.questions]

    assert len(first_ids) == 20
    assert len(first_ids) == len(set(first_ids))
    assert len(second_ids) == 20
    assert len(second_ids) == len(set(second_ids))
    assert set(first_ids) != set(second_ids)
    assert Counter(question_id.split("-")[1] for question_id in first_ids) == {
        "form": 6,
        "negative": 6,
        "question": 5,
        "choice": 1,
        "translation": 2,
    }
    assert first_ids[17] == "ps-choice-mean"
    assert second_ids[17] == "ps-choice-mean"
    assert all(question_id.startswith("ps-translation-") for question_id in first_ids[18:])
    assert all(question_id.startswith("ps-translation-") for question_id in second_ids[18:])
