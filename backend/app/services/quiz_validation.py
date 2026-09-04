"""Shared validation rules for quiz content and admin writes."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

ALLOWED_SELECTION_TYPES = {"single", "multiple", "open", "llm", "order", "matching"}


@dataclass
class ValidationResult:
    """Validation errors and warnings collected for quiz content."""

    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        """Returns whether the checked content has no blocking errors."""
        return not self.errors


def load_json(path: Path) -> Any:
    """Loads JSON content from disk."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def is_non_empty_string(value: Any) -> bool:
    """Checks whether a value is a non-empty string."""
    return isinstance(value, str) and value.strip() != ""


def validate_image_path(
    image_path: str,
    result: ValidationResult,
    context: str,
    static_dir: Path,
) -> None:
    """Validates image reference format and local static file existence."""
    if image_path.startswith(("http://", "https://")):
        return

    if image_path.startswith("/static/"):
        file_path = static_dir / image_path.removeprefix("/static/")
        if not file_path.exists():
            result.errors.append(f"{context}: image file does not exist: {image_path}")
        return

    result.errors.append(f"{context}: image must start with '/static/', 'http://', or 'https://'")


def validate_answers_structure(
    answers: Any,
    result: ValidationResult,
    context: str,
) -> list[dict[str, Any]]:
    """Validates structure for single/multiple-choice answers."""
    if not isinstance(answers, list) or len(answers) < 2:
        result.errors.append(f"{context}: answers must be a list with at least 2 items")
        return []

    validated_answers: list[dict[str, Any]] = []

    for i, answer in enumerate(answers):
        answer_context = f"{context} -> answer[{i}]"

        if not isinstance(answer, dict):
            result.errors.append(f"{answer_context}: answer must be an object")
            continue

        text = answer.get("text")
        is_correct = answer.get("is_correct")

        if not is_non_empty_string(text):
            result.errors.append(f"{answer_context}: text must be a non-empty string")

        if not isinstance(is_correct, bool):
            result.errors.append(f"{answer_context}: is_correct must be a boolean")

        validated_answers.append(answer)

    return validated_answers


def validate_open_answers_structure(
    accepted_answers: Any,
    result: ValidationResult,
    context: str,
) -> None:
    """Validates accepted answers used by open and LLM questions."""
    if not isinstance(accepted_answers, list) or not accepted_answers:
        result.errors.append(f"{context}: accepted_answers must be a non-empty list")
        return

    for i, answer in enumerate(accepted_answers):
        if not is_non_empty_string(answer):
            result.errors.append(
                f"{context} -> accepted_answers[{i}]: must be a non-empty string"
            )


def validate_answer_slots_structure(
    answer_slots: Any,
    result: ValidationResult,
    context: str,
) -> None:
    """Validates answer slots for multi-field open questions."""
    if not isinstance(answer_slots, list) or not answer_slots:
        result.errors.append(f"{context}: answer_slots must be a non-empty list")
        return

    for i, slot in enumerate(answer_slots):
        slot_context = f"{context} -> answer_slots[{i}]"
        if not isinstance(slot, dict):
            result.errors.append(f"{slot_context}: slot must be an object")
            continue
        validate_open_answers_structure(slot.get("accepted_answers"), result, slot_context)


def validate_order_items_structure(
    order_items: Any,
    result: ValidationResult,
    context: str,
) -> None:
    """Validates items used by order-based questions."""
    if not isinstance(order_items, list) or len(order_items) < 2:
        result.errors.append(f"{context}: order_items must be a list with at least 2 items")
        return

    seen_ids: set[str] = set()
    seen_positions: set[int] = set()

    for i, item in enumerate(order_items):
        item_context = f"{context} -> order_items[{i}]"

        if not isinstance(item, dict):
            result.errors.append(f"{item_context}: item must be an object")
            continue

        item_id = item.get("id")
        text = item.get("text")
        position = item.get("position")

        if not is_non_empty_string(item_id):
            result.errors.append(f"{item_context}: id must be a non-empty string")
        elif item_id in seen_ids:
            result.errors.append(f"{item_context}: duplicate id: {item_id}")
        else:
            seen_ids.add(item_id)

        if not is_non_empty_string(text):
            result.errors.append(f"{item_context}: text must be a non-empty string")

        if not isinstance(position, int):
            result.errors.append(f"{item_context}: position must be an integer")
        elif position in seen_positions:
            result.errors.append(f"{item_context}: duplicate position: {position}")
        else:
            seen_positions.add(position)

    expected_positions = set(range(1, len(order_items) + 1))
    if seen_positions and seen_positions != expected_positions:
        result.errors.append(
            f"{context}: order_items positions must be consecutive from 1 to {len(order_items)}"
        )


def validate_matching_pairs_structure(
    matching_pairs: Any,
    result: ValidationResult,
    context: str,
) -> None:
    """Validates pairs used by matching questions."""
    if not isinstance(matching_pairs, list) or len(matching_pairs) < 2:
        result.errors.append(f"{context}: matching_pairs must be a list with at least 2 pairs")
        return

    seen_ids: set[str] = set()
    seen_left_values: set[str] = set()

    for i, pair in enumerate(matching_pairs):
        pair_context = f"{context} -> matching_pairs[{i}]"

        if not isinstance(pair, dict):
            result.errors.append(f"{pair_context}: pair must be an object")
            continue

        pair_id = pair.get("id")
        left = pair.get("left")
        right = pair.get("right")

        if not is_non_empty_string(pair_id):
            result.errors.append(f"{pair_context}: id must be a non-empty string")
        elif pair_id in seen_ids:
            result.errors.append(f"{pair_context}: duplicate id: {pair_id}")
        else:
            seen_ids.add(pair_id)

        if not is_non_empty_string(left):
            result.errors.append(f"{pair_context}: left must be a non-empty string")
        elif left in seen_left_values:
            result.errors.append(f"{pair_context}: duplicate left value: {left}")
        else:
            seen_left_values.add(left)

        if not is_non_empty_string(right):
            result.errors.append(f"{pair_context}: right must be a non-empty string")


def validate_question(
    question: Any,
    result: ValidationResult,
    question_ids: set[str],
    chapter_question_ids: set[str],
    topic_name: str,
    static_dir: Path,
    topic_id: str | None = None,
) -> None:
    """Validates one question object according to its selection type."""
    if not isinstance(question, dict):
        result.errors.append(f"{topic_name}: question must be an object")
        return

    question_id = question.get("id")
    text = question.get("text")
    source_text = question.get("source_text")
    question_context = question.get("context")
    selection_type = question.get("selection_type")
    image = question.get("image")
    explanation = question.get("explanation")
    question_topic_id = question.get("topic_id")

    context = f"{topic_name} -> question[{question_id or '?'}]"

    if not is_non_empty_string(question_id):
        result.errors.append(f"{context}: id must be a non-empty string")
        return

    if question_id in question_ids:
        result.errors.append(f"{context}: duplicate question id inside topic: {question_id}")
    else:
        question_ids.add(question_id)

    if question_id in chapter_question_ids:
        result.errors.append(f"{context}: duplicate question id inside chapter: {question_id}")
    else:
        chapter_question_ids.add(question_id)

    if not is_non_empty_string(text):
        result.errors.append(f"{context}: text must be a non-empty string")

    if question_topic_id is not None:
        if not is_non_empty_string(question_topic_id):
            result.errors.append(f"{context}: topic_id must be null or a non-empty string")
        elif topic_id and question_topic_id != topic_id:
            result.errors.append(
                f"{context}: topic_id '{question_topic_id}' does not match topic '{topic_id}'"
            )

    if source_text is not None and not is_non_empty_string(source_text):
        result.errors.append(f"{context}: source_text must be null or a non-empty string")

    if question_context is not None:
        if not isinstance(question_context, dict):
            result.errors.append(f"{context}: context must be an object")
        else:
            if not is_non_empty_string(question_context.get("text")):
                result.errors.append(f"{context}: context.text must be a non-empty string")
            source = question_context.get("source")
            if source is not None and not is_non_empty_string(source):
                result.errors.append(f"{context}: context.source must be null or a non-empty string")

    if not is_non_empty_string(selection_type):
        result.errors.append(f"{context}: selection_type must be a non-empty string")
        return

    if selection_type not in ALLOWED_SELECTION_TYPES:
        result.errors.append(
            f"{context}: invalid selection_type '{selection_type}', allowed: {sorted(ALLOWED_SELECTION_TYPES)}"
        )
        return

    if image is not None:
        if isinstance(image, list):
            if not image:
                result.errors.append(f"{context}: image list must not be empty")
            for i, image_path in enumerate(image):
                image_context = f"{context} -> image[{i}]"
                if not is_non_empty_string(image_path):
                    result.errors.append(f"{image_context}: must be a non-empty string")
                else:
                    validate_image_path(image_path, result, image_context, static_dir)
        elif is_non_empty_string(image):
            validate_image_path(image, result, context, static_dir)
        else:
            result.errors.append(
                f"{context}: image must be null, a non-empty string, or a list of non-empty strings"
            )

    if (
        selection_type not in {"single", "multiple"}
        and explanation is not None
        and not is_non_empty_string(explanation)
    ):
        result.errors.append(f"{context}: explanation must be null or a non-empty string")

    answers = question.get("answers")
    accepted_answers = question.get("accepted_answers")
    answer_slots = question.get("answer_slots")
    order_items = question.get("order_items")
    matching_pairs = question.get("matching_pairs")

    if selection_type == "single":
        validated_answers = validate_answers_structure(answers, result, context)
        correct_count = sum(1 for answer in validated_answers if answer.get("is_correct") is True)
        if correct_count != 1:
            result.errors.append(
                f"{context}: single question must have exactly 1 correct answer, found {correct_count}"
            )
        warn_unexpected(question, result, context, ["accepted_answers", "answer_slots", "order_items", "matching_pairs"])

    elif selection_type == "multiple":
        validated_answers = validate_answers_structure(answers, result, context)
        correct_count = sum(1 for answer in validated_answers if answer.get("is_correct") is True)
        if correct_count < 2:
            result.errors.append(
                f"{context}: multiple question must have at least 2 correct answers, found {correct_count}"
            )
        warn_unexpected(question, result, context, ["accepted_answers", "answer_slots", "order_items", "matching_pairs"])

    elif selection_type == "open":
        if not is_non_empty_string(explanation):
            result.errors.append(f"{context}: explanation must be a non-empty string")
        has_accepted = "accepted_answers" in question and accepted_answers not in (None, [])
        has_slots = "answer_slots" in question and answer_slots not in (None, [])
        if has_accepted and has_slots:
            result.errors.append(
                f"{context}: open question must use accepted_answers or answer_slots, not both"
            )
        elif has_slots:
            validate_answer_slots_structure(answer_slots, result, context)
        elif has_accepted:
            validate_open_answers_structure(accepted_answers, result, context)
        else:
            result.errors.append(
                f"{context}: open question must contain accepted_answers or answer_slots"
            )
        warn_unexpected(question, result, context, ["answers", "order_items", "matching_pairs"])

    elif selection_type == "llm":
        if not is_non_empty_string(explanation):
            result.errors.append(f"{context}: explanation must be a non-empty string")
        validate_open_answers_structure(accepted_answers, result, context)
        warn_unexpected(question, result, context, ["answers", "answer_slots", "order_items", "matching_pairs"])

    elif selection_type == "order":
        if not is_non_empty_string(explanation):
            result.errors.append(f"{context}: explanation must be a non-empty string")
        validate_order_items_structure(order_items, result, context)
        warn_unexpected(question, result, context, ["answers", "accepted_answers", "answer_slots", "matching_pairs"])

    elif selection_type == "matching":
        if not is_non_empty_string(explanation):
            result.errors.append(f"{context}: explanation must be a non-empty string")
        validate_matching_pairs_structure(matching_pairs, result, context)
        warn_unexpected(question, result, context, ["answers", "accepted_answers", "answer_slots", "order_items"])


def warn_unexpected(
    question: dict[str, Any],
    result: ValidationResult,
    context: str,
    fields: list[str],
) -> None:
    """Adds warnings for populated fields that do not belong to a question type."""
    for field_name in fields:
        if field_name in question and question.get(field_name) not in (None, []):
            result.warnings.append(f"{context}: question should not contain {field_name}")


def validate_topic_data(
    data: Any,
    topic_name: str,
    result: ValidationResult,
    chapter_question_ids: set[str],
    topic_ids: set[str],
    static_dir: Path,
) -> int:
    """Validates one topic payload and returns its question count."""
    if not isinstance(data, dict):
        result.errors.append(f"{topic_name}: root must be an object")
        return 0

    topic_id = data.get("topic_id")
    topic_title = data.get("topic_title")
    questions = data.get("questions")

    if not is_non_empty_string(topic_id):
        result.errors.append(f"{topic_name}: topic_id must be a non-empty string")
    elif topic_id in topic_ids:
        result.errors.append(f"{topic_name}: duplicate topic_id in chapter: {topic_id}")
    else:
        topic_ids.add(topic_id)

    if not is_non_empty_string(topic_title):
        result.errors.append(f"{topic_name}: topic_title must be a non-empty string")

    if not isinstance(questions, list):
        result.errors.append(f"{topic_name}: questions must be a list")
        return 0

    topic_question_ids: set[str] = set()
    for question in questions:
        validate_question(
            question=question,
            result=result,
            question_ids=topic_question_ids,
            chapter_question_ids=chapter_question_ids,
            topic_name=topic_name,
            static_dir=static_dir,
            topic_id=topic_id if isinstance(topic_id, str) else None,
        )

    return len(questions)


def validate_meta_data(
    data: Any,
    meta_name: str,
    result: ValidationResult,
) -> list[str]:
    """Validates chapter metadata and returns topic filenames when possible."""
    if not isinstance(data, dict):
        result.errors.append(f"{meta_name}: root must be an object")
        return []

    required_string_fields = ["id", "title", "description", "category", "age_group"]
    for field_name in required_string_fields:
        if not is_non_empty_string(data.get(field_name)):
            result.errors.append(f"{meta_name}: {field_name} must be a non-empty string")

    questions_per_topic = data.get("questions_per_topic", 2)
    target_question_count = data.get("target_question_count", 12)
    topics = data.get("topics")

    if not isinstance(questions_per_topic, int) or questions_per_topic <= 0:
        result.errors.append(f"{meta_name}: questions_per_topic must be a positive integer")

    if not isinstance(target_question_count, int) or target_question_count <= 0:
        result.errors.append(f"{meta_name}: target_question_count must be a positive integer")

    if not isinstance(topics, list):
        result.errors.append(f"{meta_name}: topics must be a list")
        return []

    seen_topic_files: set[str] = set()
    topic_filenames: list[str] = []
    for i, topic_filename in enumerate(topics):
        if not is_non_empty_string(topic_filename):
            result.errors.append(f"{meta_name}: topics[{i}] must be a non-empty string")
            continue
        if topic_filename in seen_topic_files:
            result.errors.append(f"{meta_name}: duplicate topic file in topics: {topic_filename}")
            continue
        seen_topic_files.add(topic_filename)
        topic_filenames.append(topic_filename)

    return topic_filenames


def validate_chapter_dir(
    chapter_dir: Path,
    static_dir: Path,
    topic_overrides: dict[str, Any] | None = None,
) -> ValidationResult:
    """Validates a chapter directory, optionally replacing topic payloads in memory."""
    result = ValidationResult()
    topic_overrides = topic_overrides or {}
    meta_path = chapter_dir / "meta.json"

    if not meta_path.exists():
        result.errors.append(f"{chapter_dir.name}: missing meta.json")
        return result

    try:
        meta_data = load_json(meta_path)
    except Exception as e:
        result.errors.append(f"{meta_path}: failed to load JSON: {e}")
        return result

    topic_filenames = validate_meta_data(meta_data, meta_path.name, result)
    topic_ids: set[str] = set()
    chapter_question_ids: set[str] = set()
    total_questions = 0

    for topic_filename in topic_filenames:
        topic_path = chapter_dir / topic_filename
        if topic_filename in topic_overrides:
            topic_data = topic_overrides[topic_filename]
        else:
            if not topic_path.exists():
                result.errors.append(f"{meta_path.name}: missing topic file: {topic_filename}")
                continue
            try:
                topic_data = load_json(topic_path)
            except Exception as e:
                result.errors.append(f"{topic_path.name}: failed to load JSON: {e}")
                continue

        total_questions += validate_topic_data(
            data=topic_data,
            topic_name=topic_path.name,
            result=result,
            chapter_question_ids=chapter_question_ids,
            topic_ids=topic_ids,
            static_dir=static_dir,
        )

    topics = meta_data.get("topics") if isinstance(meta_data, dict) else []
    questions_per_topic = meta_data.get("questions_per_topic", 2) if isinstance(meta_data, dict) else 2
    target_question_count = meta_data.get("target_question_count", 12) if isinstance(meta_data, dict) else 12

    if isinstance(questions_per_topic, int) and isinstance(topics, list):
        desired_base_count = questions_per_topic * len(topics)
        if total_questions < desired_base_count:
            result.warnings.append(
                f"{chapter_dir.name}: total questions ({total_questions}) are lower than "
                f"ideal base selection ({desired_base_count}); quiz will need fallback selection"
            )

        if isinstance(target_question_count, int) and total_questions < target_question_count:
            result.warnings.append(
                f"{chapter_dir.name}: total questions ({total_questions}) are lower than "
                f"target_question_count ({target_question_count}); final quiz will be shorter"
            )

    return result
