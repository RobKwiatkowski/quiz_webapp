import json
import random
import re
import sys
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

TABLE_PAST_SIMPLE = {
    "be": {"was", "were"}, "beat": {"beat"}, "become": {"became"},
    "begin": {"began"}, "break": {"broke"}, "bring": {"brought"},
    "build": {"built"}, "burn": {"burned"}, "buy": {"bought"},
    "can": {"could"}, "catch": {"caught"}, "choose": {"chose"},
    "come": {"came"}, "cost": {"cost"}, "cut": {"cut"}, "do": {"did"},
    "draw": {"drew"}, "dream": {"dreamed"}, "drink": {"drank"},
    "drive": {"drove"}, "eat": {"ate"}, "fall": {"fell"}, "feed": {"fed"},
    "feel": {"felt"}, "fight": {"fought"}, "find": {"found"}, "fly": {"flew"},
    "forget": {"forgot"}, "forgive": {"forgave"}, "get": {"got"},
    "give": {"gave"}, "go": {"went"}, "grow": {"grew"}, "hang": {"hung"},
    "have": {"had"}, "hear": {"heard"}, "hide": {"hid"}, "hit": {"hit"},
    "hold": {"held"}, "hurt": {"hurt"}, "keep": {"kept"}, "know": {"knew"},
    "learn": {"learned"}, "leave": {"left"}, "lend": {"lent"}, "let": {"let"},
    "lie": {"lay"}, "lose": {"lost"}, "make": {"made"}, "meet": {"met"},
    "pay": {"paid"}, "put": {"put"}, "read": {"read"}, "ride": {"rode"},
    "ring": {"rang"}, "run": {"ran"}, "say": {"said"}, "see": {"saw"},
    "sell": {"sold"}, "send": {"sent"}, "set": {"set"}, "shine": {"shone"},
    "show": {"showed"}, "sing": {"sang"}, "sink": {"sank"}, "sit": {"sat"},
    "sleep": {"slept"}, "speak": {"spoke"}, "spell": {"spelled"},
    "spend": {"spent"}, "stand": {"stood"}, "steal": {"stole"},
    "sweep": {"swept"}, "swim": {"swam"}, "take": {"took"}, "teach": {"taught"},
    "tell": {"told"}, "think": {"thought"}, "understand": {"understood"},
    "wake": {"woke"}, "wear": {"wore"}, "win": {"won"}, "write": {"wrote"},
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
        "Słuchanie – Past Simple",
        "Tłumaczenie pełnych zdań",
    ]
    assert [len(topic["questions"]) for topic in topics] == [105, 15, 15, 3, 6, 10]

    questions = [question for topic in topics for question in topic["questions"]]
    question_ids = [question["id"] for question in questions]
    assert len(questions) == 154
    assert len(question_ids) == len(set(question_ids))
    form_questions = topics[0]["questions"]
    for infinitive, expected_past_forms in TABLE_PAST_SIMPLE.items():
        matching_questions = [
            question
            for question in form_questions
            if re.search(rf"\({re.escape(infinitive)}\)$", question["text"])
        ]
        assert matching_questions, infinitive
        assert any(
            expected_past_forms.intersection(question["accepted_answers"])
            for question in matching_questions
        ), infinitive
    assert all(
        question["selection_type"] == "llm"
        for question in topics[-1]["questions"]
    )
    assert all(
        question["selection_type"] != "llm"
        for topic in topics[:4]
        for question in topic["questions"]
    )
    listening = topics[-2]
    assert listening["max_questions_per_quiz"] == 1
    assert all(question["selection_type"] == "listening_fill" for question in listening["questions"])
    assert all(question["fill_mode"] == "open" for question in listening["questions"])
    assert all(len(question["fill_blanks"]) == 2 for question in listening["questions"])
    assert all(len(question["spoken_text"].rstrip(".!?").split()) <= 6 for question in listening["questions"])
    assert topics[1]["max_questions_per_quiz"] == 1
    assert topics[2]["max_questions_per_quiz"] == 1

    extra_question_ids = [question_id for question_id in question_ids if "-extra-" in question_id]
    assert len(extra_question_ids) == 20
    assert all(
        question_id.rsplit("-", 1)[-1] in IRREGULAR_VERBS
        for question_id in extra_question_ids
    )


def test_past_simple_open_answers_keep_whole_constructions():
    _meta, topics = load_content()
    forms, negatives, questions, choices, listening, translations = topics

    assert all(question["selection_type"] == "open" for question in forms["questions"])
    assert all(question["selection_type"] == "open" for question in negatives["questions"])
    assert all(question["selection_type"] == "open" for question in questions["questions"])
    assert all(question["selection_type"] == "single" for question in choices["questions"])
    assert all(question["selection_type"] == "listening_fill" for question in listening["questions"])
    assert negatives["max_questions_per_quiz"] == 1
    assert questions["max_questions_per_quiz"] == 1

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

    assert len(choices["questions"]) == 3
    assert choices["max_questions_per_quiz"] == 1
    assert all(len(choice["answers"]) == 4 for choice in choices["questions"])
    assert all(
        sum(answer["is_correct"] for answer in choice["answers"]) == 1
        for choice in choices["questions"]
    )

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
    assert all(question_id.startswith(("ps-form-", "q-")) for question_id in first_ids[:14])
    assert first_ids[14].startswith("ps-negative-")
    assert first_ids[15].startswith("ps-question-")
    choice_ids = {question["id"] for question in load_content()[1][3]["questions"]}
    assert first_ids[16] in choice_ids
    assert second_ids[16] in choice_ids
    assert first_ids[17].startswith("ps-listening-")
    assert second_ids[17].startswith("ps-listening-")
    assert all(question_id.startswith("ps-translation-") for question_id in first_ids[18:])
    assert all(question_id.startswith("ps-translation-") for question_id in second_ids[18:])


def test_past_simple_all_six_listening_questions_can_be_drawn():
    listening_ids = set()

    for seed in range(200):
        random.seed(seed)
        quiz = build_quiz_from_chapter(CHAPTER_DIR)
        listening_ids.add(quiz.questions[17].id)

    assert listening_ids == {
        "ps-listening-01",
        "ps-listening-02",
        "ps-listening-03",
        "ps-listening-04",
        "ps-listening-05",
        "ps-listening-06",
    }
