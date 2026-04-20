from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CHAPTERS_DIR = PROJECT_ROOT / "backend" / "app" / "data" / "chapters"
STATIC_DIR = PROJECT_ROOT / "backend" / "app" / "static"

ALLOWED_SELECTION_TYPES = {"single", "multiple", "open"}


def load_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def is_non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and value.strip() != ""


def validate_image_path(image_path: str, errors: list[str], context: str) -> None:
    if not image_path.startswith("/static/"):
        errors.append(f"{context}: image must start with '/static/'")
        return

    relative_path = image_path.removeprefix("/static/")
    file_path = STATIC_DIR / relative_path
    if not file_path.exists():
        errors.append(f"{context}: image file does not exist: {image_path}")


def validate_answers_structure(
    answers: Any, errors: list[str], context: str
) -> list[dict[str, Any]]:
    if not isinstance(answers, list) or not answers:
        errors.append(f"{context}: answers must be a non-empty list")
        return []

    validated_answers: list[dict[str, Any]] = []

    for i, answer in enumerate(answers):
        answer_context = f"{context} -> answer[{i}]"

        if not isinstance(answer, dict):
            errors.append(f"{answer_context}: answer must be an object")
            continue

        text = answer.get("text")
        is_correct = answer.get("is_correct")

        if not is_non_empty_string(text):
            errors.append(f"{answer_context}: text must be a non-empty string")

        if not isinstance(is_correct, bool):
            errors.append(f"{answer_context}: is_correct must be a boolean")

        validated_answers.append(answer)

    return validated_answers


def validate_open_answers_structure(
    accepted_answers: Any, errors: list[str], context: str
) -> None:
    if not isinstance(accepted_answers, list) or not accepted_answers:
        errors.append(f"{context}: accepted_answers must be a non-empty list")
        return

    for i, answer in enumerate(accepted_answers):
        if not is_non_empty_string(answer):
            errors.append(
                f"{context} -> accepted_answers[{i}]: must be a non-empty string"
            )


def validate_question(
    question: Any,
    errors: list[str],
    warnings: list[str],
    question_ids: set[str],
    chapter_question_ids: set[str],
    topic_path: Path,
) -> None:
    if not isinstance(question, dict):
        errors.append(f"{topic_path.name}: question must be an object")
        return

    question_id = question.get("id")
    text = question.get("text")
    selection_type = question.get("selection_type")
    image = question.get("image")
    explanation = question.get("explanation")

    context = f"{topic_path.name} -> question[{question_id or '?'}]"

    if not is_non_empty_string(question_id):
        errors.append(f"{context}: id must be a non-empty string")
        return

    if question_id in question_ids:
        errors.append(f"{context}: duplicate question id inside topic: {question_id}")
    else:
        question_ids.add(question_id)

    if question_id in chapter_question_ids:
        errors.append(f"{context}: duplicate question id inside chapter: {question_id}")
    else:
        chapter_question_ids.add(question_id)

    if not is_non_empty_string(text):
        errors.append(f"{context}: text must be a non-empty string")

    if not is_non_empty_string(selection_type):
        errors.append(f"{context}: selection_type must be a non-empty string")
        return

    if selection_type not in ALLOWED_SELECTION_TYPES:
        errors.append(
            f"{context}: invalid selection_type '{selection_type}', "
            f"allowed: {sorted(ALLOWED_SELECTION_TYPES)}"
        )
        return

    if image is not None:
        if not is_non_empty_string(image):
            errors.append(f"{context}: image must be null or a non-empty string")
        else:
            validate_image_path(image, errors, context)

    if explanation is not None and not is_non_empty_string(explanation):
        errors.append(f"{context}: explanation must be null or a non-empty string")

    answers = question.get("answers")
    accepted_answers = question.get("accepted_answers")

    if selection_type == "single":
        validated_answers = validate_answers_structure(answers, errors, context)
        correct_count = sum(
            1 for answer in validated_answers if answer.get("is_correct") is True
        )
        if correct_count != 1:
            errors.append(
                f"{context}: single question must have exactly 1 correct answer, "
                f"found {correct_count}"
            )
        if "accepted_answers" in question:
            warnings.append(
                f"{context}: single question should not contain accepted_answers"
            )

    elif selection_type == "multiple":
        validated_answers = validate_answers_structure(answers, errors, context)
        correct_count = sum(
            1 for answer in validated_answers if answer.get("is_correct") is True
        )
        if correct_count < 2:
            errors.append(
                f"{context}: multiple question must have at least 2 correct answers, "
                f"found {correct_count}"
            )
        if "accepted_answers" in question:
            warnings.append(
                f"{context}: multiple question should not contain accepted_answers"
            )

    elif selection_type == "open":
        validate_open_answers_structure(accepted_answers, errors, context)
        if "answers" in question and answers not in (None, []):
            warnings.append(
                f"{context}: open question should not contain answers"
            )


def validate_topic_file(
    topic_path: Path,
    errors: list[str],
    warnings: list[str],
    chapter_question_ids: set[str],
    topic_ids: set[str],
) -> int:
    try:
        data = load_json(topic_path)
    except Exception as e:
        errors.append(f"{topic_path.name}: failed to load JSON: {e}")
        return 0

    if not isinstance(data, dict):
        errors.append(f"{topic_path.name}: root must be an object")
        return 0

    topic_id = data.get("topic_id")
    topic_title = data.get("topic_title")
    questions = data.get("questions")

    if not is_non_empty_string(topic_id):
        errors.append(f"{topic_path.name}: topic_id must be a non-empty string")
    elif topic_id in topic_ids:
        errors.append(f"{topic_path.name}: duplicate topic_id in chapter: {topic_id}")
    else:
        topic_ids.add(topic_id)

    if not is_non_empty_string(topic_title):
        errors.append(f"{topic_path.name}: topic_title must be a non-empty string")

    if not isinstance(questions, list) or not questions:
        errors.append(f"{topic_path.name}: questions must be a non-empty list")
        return 0

    topic_question_ids: set[str] = set()

    for question in questions:
        validate_question(
            question=question,
            errors=errors,
            warnings=warnings,
            question_ids=topic_question_ids,
            chapter_question_ids=chapter_question_ids,
            topic_path=topic_path,
        )

    return len(questions)


def validate_meta_file(
    meta_path: Path,
    errors: list[str],
    warnings: list[str],
) -> None:
    chapter_dir = meta_path.parent

    try:
        data = load_json(meta_path)
    except Exception as e:
        errors.append(f"{meta_path}: failed to load JSON: {e}")
        return

    if not isinstance(data, dict):
        errors.append(f"{meta_path.name}: root must be an object")
        return

    required_string_fields = ["id", "title", "description", "category", "age_group"]
    for field in required_string_fields:
        if not is_non_empty_string(data.get(field)):
            errors.append(f"{meta_path.name}: {field} must be a non-empty string")

    questions_per_topic = data.get("questions_per_topic", 2)
    target_question_count = data.get("target_question_count", 12)
    topics = data.get("topics")

    if not isinstance(questions_per_topic, int) or questions_per_topic <= 0:
        errors.append(f"{meta_path.name}: questions_per_topic must be a positive integer")

    if not isinstance(target_question_count, int) or target_question_count <= 0:
        errors.append(f"{meta_path.name}: target_question_count must be a positive integer")

    if not isinstance(topics, list) or not topics:
        errors.append(f"{meta_path.name}: topics must be a non-empty list")
        return

    seen_topic_files: set[str] = set()
    topic_ids: set[str] = set()
    chapter_question_ids: set[str] = set()
    total_questions = 0

    for i, topic_filename in enumerate(topics):
        if not is_non_empty_string(topic_filename):
            errors.append(f"{meta_path.name}: topics[{i}] must be a non-empty string")
            continue

        if topic_filename in seen_topic_files:
            errors.append(f"{meta_path.name}: duplicate topic file in topics: {topic_filename}")
            continue

        seen_topic_files.add(topic_filename)
        topic_path = chapter_dir / topic_filename

        if not topic_path.exists():
            errors.append(f"{meta_path.name}: missing topic file: {topic_filename}")
            continue

        total_questions += validate_topic_file(
            topic_path=topic_path,
            errors=errors,
            warnings=warnings,
            chapter_question_ids=chapter_question_ids,
            topic_ids=topic_ids,
        )

    if isinstance(questions_per_topic, int) and isinstance(topics, list):
        desired_base_count = questions_per_topic * len(topics)
        if total_questions < desired_base_count:
            warnings.append(
                f"{chapter_dir.name}: total questions ({total_questions}) are lower than "
                f"ideal base selection ({desired_base_count}); quiz will need fallback selection"
            )

        if isinstance(target_question_count, int) and total_questions < target_question_count:
            warnings.append(
                f"{chapter_dir.name}: total questions ({total_questions}) are lower than "
                f"target_question_count ({target_question_count}); final quiz will be shorter"
            )


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    if not CHAPTERS_DIR.exists():
        print(f"ERROR: chapters directory does not exist: {CHAPTERS_DIR}")
        return 1

    chapter_dirs = sorted([p for p in CHAPTERS_DIR.iterdir() if p.is_dir()])
    if not chapter_dirs:
        print(f"ERROR: no chapter directories found in: {CHAPTERS_DIR}")
        return 1

    for chapter_dir in chapter_dirs:
        meta_path = chapter_dir / "meta.json"
        if not meta_path.exists():
            errors.append(f"{chapter_dir.name}: missing meta.json")
            continue

        validate_meta_file(meta_path, errors, warnings)

    if warnings:
        print("WARNINGS:")
        for warning in warnings:
            print(f"  - {warning}")

    if errors:
        print("ERRORS:")
        for error in errors:
            print(f"  - {error}")
        return 1

    print("OK: all quiz files passed validation")
    return 0


if __name__ == "__main__":
    sys.exit(main())