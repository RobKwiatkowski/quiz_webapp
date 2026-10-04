import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.quiz_loader import build_quiz_from_chapter


CHAPTER_DIR = (
    Path(__file__).resolve().parents[1]
    / "app"
    / "data"
    / "chapters"
    / "english-one-big-family"
)


def load_content() -> tuple[dict, list[dict]]:
    meta = json.loads((CHAPTER_DIR / "meta.json").read_text(encoding="utf-8"))
    topics = [
        json.loads((CHAPTER_DIR / filename).read_text(encoding="utf-8"))
        for filename in meta["topics"]
    ]
    return meta, topics


def test_one_big_family_has_sixty_five_unique_questions_and_listening_pool():
    meta, topics = load_content()
    grammar, vocabulary, listening, translations = topics

    assert meta["id"] == "english-one-big-family"
    assert meta["category"] == "english"
    assert meta["target_question_count"] == 15
    assert [len(topic["questions"]) for topic in topics] == [25, 30, 5, 5]

    questions = [question for topic in topics for question in topic["questions"]]
    question_ids = [question["id"] for question in questions]

    assert len(questions) == 65
    assert len(question_ids) == len(set(question_ids))
    assert len(grammar["questions"]) + len(translations["questions"]) == 30
    assert len(vocabulary["questions"]) == 30
    assert all(question["selection_type"] == "open" for question in grammar["questions"])
    assert all(question["selection_type"] == "fill" for question in vocabulary["questions"])
    assert all(question["fill_mode"] == "open" for question in vocabulary["questions"])
    assert all(question["selection_type"] == "listening_fill" for question in listening["questions"])
    assert all(question["fill_mode"] == "open" for question in listening["questions"])
    assert all(len(question["fill_blanks"]) == 2 for question in listening["questions"])
    assert all(len(question["spoken_text"].rstrip(".!?").split()) <= 6 for question in listening["questions"])
    assert listening["max_questions_per_quiz"] == 2
    assert all(question["selection_type"] == "llm" for question in translations["questions"])
    assert translations["max_questions_per_quiz"] == 1


def test_one_big_family_attempt_has_fifteen_questions_and_translation_is_last():
    for seed in range(20):
        random.seed(seed)
        quiz = build_quiz_from_chapter(CHAPTER_DIR)
        question_ids = [question.id for question in quiz.questions]

        assert len(question_ids) == 15
        assert len(question_ids) == len(set(question_ids))
        assert all(question_id.startswith("obf-grammar-") for question_id in question_ids[:6])
        assert all(question_id.startswith("obf-vocabulary-") for question_id in question_ids[6:12])
        assert all(question_id.startswith("obf-listening-") for question_id in question_ids[12:14])
        assert question_ids[-1].startswith("obf-translation-")


def test_one_big_family_all_five_translations_can_be_drawn():
    translation_ids = set()

    for seed in range(100):
        random.seed(seed)
        quiz = build_quiz_from_chapter(CHAPTER_DIR)
        translation_ids.add(quiz.questions[-1].id)

    assert translation_ids == {
        "obf-translation-01",
        "obf-translation-02",
        "obf-translation-03",
        "obf-translation-04",
        "obf-translation-05",
    }


def test_one_big_family_all_five_listening_questions_can_be_drawn():
    listening_ids = set()

    for seed in range(100):
        random.seed(seed)
        quiz = build_quiz_from_chapter(CHAPTER_DIR)
        listening_ids.update(question.id for question in quiz.questions[12:14])

    assert listening_ids == {
        "obf-listening-01",
        "obf-listening-02",
        "obf-listening-03",
        "obf-listening-04",
        "obf-listening-05",
    }
