"""Small JSON-backed admin content helpers."""

from __future__ import annotations

import json
import os
import base64
import binascii
import shutil
import tempfile
import unicodedata
import uuid
from collections import Counter
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from pydantic import ValidationError

from app.config import settings
from app.models.quiz import ChapterMeta, Question, TopicFile
from app.services.quiz_loader import load_chapter_meta, load_topic_file
from app.services.quiz_validation import validate_chapter_dir

STATIC_DIR = Path(__file__).resolve().parents[1] / "static"
ALLOWED_IMAGE_EXTENSIONS = {".gif", ".jpeg", ".jpg", ".png", ".webp"}
MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024
SUPPORTED_SUBJECTS = {
    "history": "Historia",
    "geography": "Geografia",
    "biology": "Biologia",
    "math": "Matematyka",
}
MATH_ONLY_SELECTION_TYPES = {
    "operation_order",
    "timed_division",
    "timed_multiplication",
    "written_division",
    "written_multiplication",
}


def get_chapter_dir(chapter_id: str) -> Path:
    """Resolves a chapter by metadata ID or directory name."""
    chapters_dir = Path(settings.quiz_data_dir)
    for chapter_dir in sorted([p for p in chapters_dir.iterdir() if p.is_dir()]):
        try:
            meta = load_chapter_meta(chapter_dir)
        except Exception:
            continue
        if meta.id == chapter_id or chapter_dir.name == chapter_id:
            return chapter_dir
    raise HTTPException(status_code=404, detail="Chapter not found")


def list_admin_subjects() -> list[dict[str, str]]:
    """Returns subjects that use the JSON-backed chapter/topic quiz method."""
    return [
        {"id": subject_id, "title": title}
        for subject_id, title in SUPPORTED_SUBJECTS.items()
    ]


def list_admin_chapters(subject: str | None = None) -> list[dict[str, Any]]:
    """Returns chapters available for admin editing."""
    if subject is not None:
        subject = normalize_subject(subject)

    chapters = []
    chapters_dir = Path(settings.quiz_data_dir)
    for chapter_dir in sorted([p for p in chapters_dir.iterdir() if p.is_dir()]):
        meta = load_chapter_meta(chapter_dir)
        if subject and meta.category != subject:
            continue
        chapters.append(
            {
                "id": meta.id,
                "title": meta.title,
                "subject": meta.category,
                "chapter_number": meta.chapter_number,
                "target_question_count": meta.target_question_count,
            }
        )
    return chapters


def create_chapter(payload: dict[str, Any]) -> dict[str, Any]:
    """Creates a new empty chapter directory with metadata."""
    name = str(payload.get("name", "")).strip()
    if not name:
        raise HTTPException(status_code=400, detail="Chapter name cannot be empty")
    subject = normalize_subject(payload.get("subject", "history"))

    chapters_dir = Path(settings.quiz_data_dir)
    chapters_dir.mkdir(parents=True, exist_ok=True)
    existing_chapter_ids = set()
    for existing_dir in [p for p in chapters_dir.iterdir() if p.is_dir()]:
        existing_chapter_ids.add(existing_dir.name)
        try:
            existing_chapter_ids.add(load_chapter_meta(existing_dir).id)
        except Exception:
            continue

    chapter_id = generate_unique_slug(name, existing_chapter_ids)
    chapter_dir = chapters_dir / chapter_id
    chapter_dir.mkdir()

    meta_data = {
        "id": chapter_id,
        "title": name,
        "description": f"Powtórka z rozdziału {name}.",
        "category": subject,
        "age_group": "10-12",
        "chapter_number": None,
        "target_question_count": 12,
        "questions_per_topic": 2,
        "topics": [],
    }

    try:
        ChapterMeta.model_validate(meta_data)
        write_json_file(chapter_dir / "meta.json", meta_data)
    except Exception:
        shutil.rmtree(chapter_dir)
        raise

    return {
        "id": chapter_id,
        "title": name,
        "subject": subject,
        "chapter_number": None,
        "target_question_count": 12,
    }


def normalize_subject(value: Any) -> str:
    """Validates and returns a supported admin subject identifier."""
    subject = str(value or "").strip()
    if subject not in SUPPORTED_SUBJECTS:
        raise HTTPException(status_code=400, detail="Unsupported subject")
    return subject


def update_chapter_number(chapter_id: str, chapter_number: int | None) -> dict[str, Any]:
    """Sets or clears the optional number shown on a chapter card."""
    chapter_dir = get_chapter_dir(chapter_id)
    meta_path = chapter_dir / "meta.json"
    with open(meta_path, "r", encoding="utf-8") as f:
        meta_data = json.load(f)

    if chapter_number is None:
        meta_data.pop("chapter_number", None)
    else:
        meta_data["chapter_number"] = chapter_number
    save_meta_data(chapter_dir, meta_data)

    meta = load_chapter_meta(chapter_dir)
    return {
        "id": meta.id,
        "title": meta.title,
        "subject": meta.category,
        "chapter_number": meta.chapter_number,
        "target_question_count": meta.target_question_count,
    }


def update_target_question_count(chapter_id: str, target_question_count: int) -> dict[str, Any]:
    """Sets the number of questions randomly selected for a chapter quiz."""
    chapter_dir = get_chapter_dir(chapter_id)
    meta_path = chapter_dir / "meta.json"
    with open(meta_path, "r", encoding="utf-8") as f:
        meta_data = json.load(f)

    meta_data["target_question_count"] = target_question_count
    save_meta_data(chapter_dir, meta_data)

    meta = load_chapter_meta(chapter_dir)
    return {
        "id": meta.id,
        "title": meta.title,
        "subject": meta.category,
        "chapter_number": meta.chapter_number,
        "target_question_count": meta.target_question_count,
    }


def get_topic_filename(chapter_dir: Path, topic_id: str) -> str:
    """Resolves a topic ID to its JSON filename inside a chapter."""
    meta = load_chapter_meta(chapter_dir)
    for topic_filename in meta.topics:
        topic = load_topic_file(chapter_dir, topic_filename)
        if topic.topic_id == topic_id:
            return topic_filename
    raise HTTPException(status_code=404, detail="Topic not found")


def list_admin_topics(chapter_id: str) -> list[dict[str, Any]]:
    """Returns topic titles and activation states for an existing chapter."""
    chapter_dir = get_chapter_dir(chapter_id)
    meta = load_chapter_meta(chapter_dir)
    topics = []
    for topic_filename in meta.topics:
        topic = load_topic_file(chapter_dir, topic_filename)
        topics.append({"id": topic.topic_id, "title": topic.topic_title, "is_active": topic.is_active, "question_count": len(topic.questions)})
    return topics


def list_admin_images(chapter_id: str) -> dict[str, Any]:
    """Lists reusable static images and selects the chapter's usual folder."""
    chapter_dir = get_chapter_dir(chapter_id)
    meta = load_chapter_meta(chapter_dir)
    images_root = STATIC_DIR / "images"
    subject_root = images_root / meta.category

    images = []
    if subject_root.exists():
        for image_path in sorted(path for path in subject_root.rglob("*") if path.is_file()):
            if image_path.suffix.lower() not in ALLOWED_IMAGE_EXTENSIONS:
                continue
            relative_path = image_path.relative_to(images_root).as_posix()
            images.append(
                {
                    "path": f"/static/images/{relative_path}",
                    "filename": image_path.name,
                    "folder": Path(relative_path).parent.as_posix(),
                }
            )

    referenced_folders: Counter[str] = Counter()
    for topic_filename in meta.topics:
        topic = load_topic_file(chapter_dir, topic_filename)
        for question in topic.questions:
            image_values = question.image if isinstance(question.image, list) else [question.image]
            for image_value in image_values:
                if not isinstance(image_value, str) or not image_value.startswith("/static/images/"):
                    continue
                relative_path = image_value.removeprefix("/static/images/")
                folder = Path(relative_path).parent.as_posix()
                if folder == meta.category or folder.startswith(f"{meta.category}/"):
                    referenced_folders[folder] += 1

    folders = sorted({image["folder"] for image in images})
    default_folder = (
        referenced_folders.most_common(1)[0][0]
        if referenced_folders
        else (folders[0] if folders else meta.category)
    )
    return {"default_folder": default_folder, "folders": folders, "images": images}


def create_topic(chapter_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Creates a new empty topic in an existing chapter."""
    name = str(payload.get("name", "")).strip()
    if not name:
        raise HTTPException(status_code=400, detail="Topic name cannot be empty")

    chapter_dir = get_chapter_dir(chapter_id)
    meta_path = chapter_dir / "meta.json"
    with open(meta_path, "r", encoding="utf-8") as f:
        meta_data = json.load(f)

    existing_topic_ids = set()
    existing_filenames = set(meta_data.get("topics", []))
    for topic_filename in meta_data.get("topics", []):
        topic = load_topic_file(chapter_dir, topic_filename)
        existing_topic_ids.add(topic.topic_id)

    topic_id = generate_unique_slug(name, existing_topic_ids)
    topic_filename = generate_topic_filename(topic_id, existing_filenames)
    topic_data = {
        "topic_id": topic_id,
        "topic_title": name,
        "is_active": False,
        "questions": [],
    }

    TopicFile.model_validate(topic_data)
    meta_data["topics"] = [*meta_data.get("topics", []), topic_filename]
    ChapterMeta.model_validate(meta_data)

    write_json_file(chapter_dir / topic_filename, topic_data)
    save_meta_data(chapter_dir, meta_data)

    return {"id": topic_id, "title": name, "is_active": False, "question_count": 0}


def update_topic_active(chapter_id: str, topic_id: str, is_active: bool) -> dict[str, Any]:
    """Activates or deactivates one topic without removing its questions."""
    chapter_dir, topic_filename, topic_data = get_topic_data(chapter_id, topic_id)
    topic_data["is_active"] = is_active
    save_topic_data(chapter_dir, topic_filename, topic_data)
    return {
        "id": topic_data["topic_id"],
        "title": topic_data["topic_title"],
        "is_active": is_active,
        "question_count": len(topic_data.get("questions", [])),
    }


def delete_topic(chapter_id: str, topic_id: str) -> dict[str, Any]:
    """Removes a topic from its chapter and archives its JSON for recovery."""
    chapter_dir, topic_filename, topic_data = get_topic_data(chapter_id, topic_id)
    meta_path = chapter_dir / "meta.json"
    with open(meta_path, "r", encoding="utf-8") as f:
        meta_data = json.load(f)

    topics = meta_data.get("topics", [])
    if topic_filename not in topics:
        raise HTTPException(status_code=404, detail="Topic not found")

    meta_data["topics"] = [filename for filename in topics if filename != topic_filename]
    try:
        ChapterMeta.model_validate(meta_data)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    topic_path = chapter_dir / topic_filename
    backup_path = topic_path.with_suffix(topic_path.suffix + ".bak")
    archive_dir = chapter_dir / "_deleted_topics"
    archive_dir.mkdir(exist_ok=True)
    archive_stem = f"{topic_path.stem}-{uuid.uuid4().hex[:8]}"
    archived_topic_path = archive_dir / f"{archive_stem}.json"
    archived_backup_path = archive_dir / f"{archive_stem}.json.bak"
    moved_backup = False

    try:
        shutil.move(topic_path, archived_topic_path)
        if backup_path.exists():
            shutil.move(backup_path, archived_backup_path)
            moved_backup = True
        save_meta_data(chapter_dir, meta_data)
    except Exception:
        if archived_topic_path.exists():
            shutil.move(archived_topic_path, topic_path)
        if moved_backup and archived_backup_path.exists():
            shutil.move(archived_backup_path, backup_path)
        raise

    return {
        "status": "deleted",
        "id": topic_id,
        "title": topic_data.get("topic_title", topic_id),
        "question_count": len(topic_data.get("questions", [])),
        "archived": True,
    }


def get_topic_data(chapter_id: str, topic_id: str) -> tuple[Path, str, dict[str, Any]]:
    """Loads raw topic JSON data for admin mutation."""
    chapter_dir = get_chapter_dir(chapter_id)
    topic_filename = get_topic_filename(chapter_dir, topic_id)
    topic_path = chapter_dir / topic_filename
    with open(topic_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return chapter_dir, topic_filename, data


def list_admin_questions(chapter_id: str, topic_id: str) -> list[dict[str, Any]]:
    """Returns questions from one topic."""
    _, _, topic_data = get_topic_data(chapter_id, topic_id)
    return topic_data.get("questions", [])


def create_question(chapter_id: str, topic_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Creates a question in an existing topic JSON file."""
    chapter_dir, topic_filename, topic_data = get_topic_data(chapter_id, topic_id)
    existing_ids = get_chapter_question_ids(chapter_dir)
    question = normalize_admin_question(payload, generate_question_id(existing_ids), chapter_id, topic_id)
    topic_data["questions"].append(question)
    save_topic_data(chapter_dir, topic_filename, topic_data)
    return question


def update_question(
    chapter_id: str,
    topic_id: str,
    question_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Updates a question while keeping its original ID stable."""
    chapter_dir, topic_filename, topic_data = get_topic_data(chapter_id, topic_id)
    questions = topic_data.get("questions", [])

    for index, existing_question in enumerate(questions):
        if existing_question.get("id") == question_id:
            question = normalize_admin_question(payload, question_id, chapter_id, topic_id)
            question["is_active"] = existing_question.get("is_active", True)
            questions[index] = question
            save_topic_data(chapter_dir, topic_filename, topic_data)
            return question

    raise HTTPException(status_code=404, detail="Question not found")


def update_question_active(
    chapter_id: str,
    topic_id: str,
    question_id: str,
    is_active: bool,
) -> dict[str, Any]:
    """Activates or deactivates one question without deleting it."""
    chapter_dir, topic_filename, topic_data = get_topic_data(chapter_id, topic_id)
    questions = topic_data.get("questions", [])

    for question in questions:
        if question.get("id") == question_id:
            question["is_active"] = is_active
            save_topic_data(chapter_dir, topic_filename, topic_data)
            return question

    raise HTTPException(status_code=404, detail="Question not found")


def delete_question(chapter_id: str, topic_id: str, question_id: str) -> dict[str, str]:
    """Deletes a question from an existing topic JSON file."""
    chapter_dir, topic_filename, topic_data = get_topic_data(chapter_id, topic_id)
    questions = topic_data.get("questions", [])
    remaining_questions = [q for q in questions if q.get("id") != question_id]

    if len(remaining_questions) == len(questions):
        raise HTTPException(status_code=404, detail="Question not found")

    topic_data["questions"] = remaining_questions
    save_topic_data(chapter_dir, topic_filename, topic_data)
    return {"status": "deleted"}


def move_question(
    chapter_id: str,
    source_topic_id: str,
    question_id: str,
    target_topic_id: str,
) -> dict[str, Any]:
    """Moves one question between two topics in the same chapter."""
    if source_topic_id == target_topic_id:
        raise HTTPException(status_code=400, detail="Wybierz inny temat docelowy")

    chapter_dir, source_filename, source_data = get_topic_data(chapter_id, source_topic_id)
    _, target_filename, target_data = get_topic_data(chapter_id, target_topic_id)
    source_questions = source_data.get("questions", [])
    target_questions = target_data.get("questions", [])
    question = next(
        (item for item in source_questions if item.get("id") == question_id),
        None,
    )
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    if any(item.get("id") == question_id for item in target_questions):
        raise HTTPException(
            status_code=409,
            detail="Pytanie o tym identyfikatorze już istnieje w temacie docelowym",
        )

    moved_question = {**question, "topic_id": target_topic_id}
    source_data["questions"] = [
        item for item in source_questions if item.get("id") != question_id
    ]
    target_data["questions"] = [*target_questions, moved_question]
    save_topic_pair_data(
        chapter_dir,
        source_filename,
        source_data,
        target_filename,
        target_data,
    )
    return moved_question


def normalize_admin_question(
    payload: dict[str, Any],
    question_id: str,
    chapter_id: str,
    topic_id: str,
) -> dict[str, Any]:
    """Keeps the stored question payload small and type-specific."""
    selection_type = payload.get("selection_type", "single")
    chapter = load_chapter_meta(get_chapter_dir(chapter_id))
    if selection_type in MATH_ONLY_SELECTION_TYPES and chapter.category != "math":
        raise HTTPException(
            status_code=400,
            detail="This question type is available only for math chapters",
        )
    question: dict[str, Any] = {
        "id": question_id,
        "topic_id": topic_id,
        "is_active": True,
        "text": str(payload.get("text", "")).strip(),
        "selection_type": selection_type,
    }
    explanation = str(payload.get("explanation", "")).strip()
    if explanation:
        question["explanation"] = explanation

    for field_name in ["source_text"]:
        value = payload.get(field_name)
        if value not in (None, "", []):
            question[field_name] = value

    image_value = normalize_question_image(payload, question_id, chapter_id, topic_id, selection_type)
    if image_value:
        question["image"] = image_value

    context = payload.get("context")
    if isinstance(context, dict):
        context_data = {
            key: str(context.get(key, "")).strip()
            for key in ["text", "source"]
            if str(context.get(key, "")).strip()
        }
        if context_data:
            question["context"] = context_data

    if selection_type in {"single", "multiple", "true_false"}:
        question["answers"] = [
            {"text": str(answer.get("text", "")).strip(), "is_correct": bool(answer.get("is_correct"))}
            for answer in payload.get("answers", [])
            if isinstance(answer, dict)
        ]
    elif selection_type in {"open", "llm"}:
        answer_slots = payload.get("answer_slots")
        if selection_type == "open" and isinstance(answer_slots, list) and answer_slots:
            question["answer_slots"] = [
                {
                    "accepted_answers": [
                        str(answer).strip()
                        for answer in slot.get("accepted_answers", [])
                        if str(answer).strip()
                    ]
                }
                for slot in answer_slots
                if isinstance(slot, dict)
            ]
        else:
            question["accepted_answers"] = [
                str(answer).strip()
                for answer in payload.get("accepted_answers", [])
                if str(answer).strip()
            ]
    elif selection_type == "order":
        question["order_items"] = normalize_order_items(payload.get("order_items", []))
    elif selection_type == "matching":
        question["matching_pairs"] = normalize_matching_pairs(payload.get("matching_pairs", []))
    elif selection_type == "map":
        map_config = payload.get("map_config")
        if not isinstance(map_config, dict):
            raise HTTPException(status_code=400, detail="Map questions require map configuration")

        question["map_config"] = {
            "source": str(map_config.get("source", "")).strip(),
            "mode": str(map_config.get("mode", "")).strip(),
            "target_feature_id": str(map_config.get("target_feature_id", "")).strip(),
        }
        interaction = str(map_config.get("interaction", "")).strip()
        if interaction:
            question["map_config"]["interaction"] = interaction

        background_source = str(map_config.get("background_source", "")).strip()
        if background_source:
            question["map_config"]["background_source"] = background_source

        if question["map_config"]["mode"] == "identify":
            question["answers"] = [
                {"text": str(answer.get("text", "")).strip(), "is_correct": bool(answer.get("is_correct"))}
                for answer in payload.get("answers", [])
                if isinstance(answer, dict)
            ]
    elif selection_type == "hotspot":
        hotspot_config = payload.get("hotspot_config")
        if not isinstance(hotspot_config, dict):
            raise HTTPException(
                status_code=400,
                detail="Hotspot questions require hotspot configuration",
            )

        question["hotspot_config"] = {
            "source": str(hotspot_config.get("source", "")).strip(),
            "target_hotspot_id": str(hotspot_config.get("target_hotspot_id", "")).strip(),
        }
    elif selection_type == "fill":
        question["fill_mode"] = str(payload.get("fill_mode", "")).strip()
        question["fill_blanks"] = [
            {
                "id": str(blank.get("id", "")).strip(),
                "accepted_answers": [
                    str(answer).strip()
                    for answer in blank.get("accepted_answers", [])
                    if str(answer).strip()
                ],
                "options": [
                    str(option).strip()
                    for option in blank.get("options", [])
                    if str(option).strip()
                ],
            }
            for blank in payload.get("fill_blanks", [])
            if isinstance(blank, dict)
        ]
    elif selection_type == "written_multiplication":
        config = payload.get("written_multiplication_config")
        if not isinstance(config, dict):
            raise HTTPException(
                status_code=400,
                detail="Written multiplication questions require factor limits",
            )
        question["written_multiplication_config"] = {
            "min_factor": config.get("min_factor"),
            "max_factor": config.get("max_factor"),
            "max_total_digits": config.get("max_total_digits", 6),
            "easy_max_total_digits": config.get("easy_max_total_digits", 4),
            "easy_max_partial_product": config.get("easy_max_partial_product", 100),
        }
    elif selection_type == "timed_multiplication":
        config = payload.get("timed_multiplication_config")
        if not isinstance(config, dict):
            raise HTTPException(
                status_code=400,
                detail="Timed multiplication questions require generation limits",
            )
        question["timed_multiplication_config"] = {
            "min_factor": config.get("min_factor", 3),
            "max_factor": config.get("max_factor", 9),
            "time_limit_seconds": config.get("time_limit_seconds", 5),
        }
    elif selection_type == "timed_division":
        config = payload.get("timed_division_config")
        if not isinstance(config, dict):
            raise HTTPException(
                status_code=400,
                detail="Timed division questions require generation limits",
            )
        question["timed_division_config"] = {
            "min_divisor": config.get("min_divisor", 3),
            "max_divisor": config.get("max_divisor", 9),
            "min_quotient": config.get("min_quotient", 3),
            "max_quotient": config.get("max_quotient", 9),
            "time_limit_seconds": config.get("time_limit_seconds", 10),
        }
    elif selection_type == "written_division":
        config = payload.get("written_division_config")
        if not isinstance(config, dict):
            raise HTTPException(
                status_code=400,
                detail="Written division questions require generation limits",
            )
        question["written_division_config"] = {
            "min_divisor": config.get("min_divisor", 2),
            "max_divisor": config.get("max_divisor", 99),
            "min_quotient": config.get("min_quotient", 10),
            "max_quotient": config.get("max_quotient", 9999),
            "max_dividend_digits": config.get("max_dividend_digits", 6),
            "easy_min_divisor": config.get("easy_min_divisor", 3),
            "easy_max_divisor": config.get("easy_max_divisor", 10),
            "medium_min_divisor": config.get("medium_min_divisor", 8),
            "medium_max_divisor": config.get("medium_max_divisor", 15),
            "easy_max_quotient": config.get("easy_max_quotient", 999),
            "easy_max_dividend_digits": config.get("easy_max_dividend_digits", 4),
            "easy_max_intermediate_value": config.get("easy_max_intermediate_value", 100),
        }
    elif selection_type == "operation_order":
        config = payload.get("operation_order_config")
        if not isinstance(config, dict):
            raise HTTPException(
                status_code=400,
                detail="Order-of-operations questions require a concept family",
            )
        question["operation_order_config"] = {
            "family": str(config.get("family", "")).strip(),
        }
    else:
        raise HTTPException(
            status_code=400,
            detail=(
                "Admin supports only single, multiple, true_false, open, llm, order, matching, "
                "map, hotspot, fill, timed_multiplication, timed_division, written_multiplication, "
                "written_division, and operation_order questions"
            ),
        )

    try:
        Question.model_validate(question)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return question


def normalize_order_items(items: Any) -> list[dict[str, Any]]:
    """Normalizes admin-entered sequence items into ordered quiz data."""
    if not isinstance(items, list):
        return []

    order_items = []
    used_ids: set[str] = set()
    for item in items:
        if not isinstance(item, dict):
            continue

        text = str(item.get("text", "")).strip()
        if not text:
            continue

        item_id = str(item.get("id", "")).strip()
        if not item_id:
            item_id = generate_unique_slug(text, used_ids)
        elif item_id in used_ids:
            item_id = generate_unique_slug(item_id, used_ids)

        used_ids.add(item_id)
        order_items.append({"id": item_id, "text": text, "position": len(order_items) + 1})

    return order_items


def normalize_matching_pairs(items: Any) -> list[dict[str, Any]]:
    """Normalizes admin-entered left/right pairs into matching quiz data."""
    if not isinstance(items, list):
        return []

    pairs = []
    used_ids: set[str] = set()
    for item in items:
        if not isinstance(item, dict):
            continue

        left = str(item.get("left", "")).strip()
        right = str(item.get("right", "")).strip()
        if not left or not right:
            continue

        pair_id = str(item.get("id", "")).strip()
        if not pair_id:
            pair_id = generate_unique_slug(left, used_ids)
        elif pair_id in used_ids:
            pair_id = generate_unique_slug(pair_id, used_ids)

        used_ids.add(pair_id)
        pairs.append({"id": pair_id, "left": left, "right": right})

    return pairs


def normalize_question_image(
    payload: dict[str, Any],
    question_id: str,
    chapter_id: str,
    topic_id: str,
    selection_type: str,
) -> str | None:
    """Returns an image URL/path, saving a local upload when provided."""
    image_value = str(payload.get("image", "")).strip()
    image_upload = payload.get("image_upload")

    if not image_value and not image_upload:
        return None

    if selection_type not in {"single", "open"}:
        raise HTTPException(
            status_code=400,
            detail="Image questions can only use single or open question types",
        )

    if image_upload:
        if image_value:
            raise HTTPException(status_code=400, detail="Use either image URL or image file, not both")
        return save_uploaded_chapter_image(image_upload, chapter_id)

    return image_value


def save_uploaded_question_image(
    image_upload: Any,
    question_id: str,
    chapter_id: str,
    topic_id: str,
) -> str:
    """Stores an admin-uploaded image in the chapter's reusable image folder.

    The extra identifiers are retained for callers from older admin flows. Image
    placement is intentionally chapter-based, so an uploaded file is available
    in the same image library before or after a question is saved.
    """
    del question_id, topic_id
    return save_uploaded_chapter_image(image_upload, chapter_id)


def save_uploaded_chapter_image(image_upload: Any, chapter_id: str) -> str:
    """Immediately stores an image in the current chapter's default folder."""
    if not isinstance(image_upload, dict):
        raise HTTPException(status_code=400, detail="Image upload must be an object")

    filename = str(image_upload.get("filename", "")).strip()
    content = str(image_upload.get("content_base64", "")).strip()
    if not filename or not content:
        raise HTTPException(status_code=400, detail="Image upload requires filename and content")

    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Image file must be PNG, JPG, GIF, or WEBP")

    if "," in content:
        content = content.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(content, validate=True)
    except (binascii.Error, ValueError) as e:
        raise HTTPException(status_code=400, detail="Image upload is not valid base64") from e

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Image file cannot be empty")

    if len(image_bytes) > MAX_IMAGE_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image file is too large")

    image_library = list_admin_images(chapter_id)
    relative_folder = Path(image_library["default_folder"])
    if relative_folder.is_absolute() or ".." in relative_folder.parts:
        raise HTTPException(status_code=500, detail="Invalid default image folder")

    upload_dir = STATIC_DIR / "images" / relative_folder
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename_slug = generate_unique_slug(Path(filename).stem, set())
    target_name = f"{filename_slug}{extension}"
    target_path = upload_dir / target_name
    suffix = 2
    while target_path.exists():
        target_name = f"{filename_slug}-{suffix}{extension}"
        target_path = upload_dir / target_name
        suffix += 1

    with open(target_path, "wb") as f:
        f.write(image_bytes)

    return f"/static/images/{relative_folder.as_posix()}/{target_name}"


def save_topic_data(chapter_dir: Path, topic_filename: str, topic_data: dict[str, Any]) -> None:
    """Validates and atomically writes one topic JSON file with a single backup."""
    try:
        TopicFile.model_validate(topic_data)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    result = validate_chapter_dir(
        chapter_dir=chapter_dir,
        static_dir=STATIC_DIR,
        topic_overrides={topic_filename: topic_data},
    )
    if not result.is_valid:
        raise HTTPException(status_code=400, detail="; ".join(result.errors))

    topic_path = chapter_dir / topic_filename
    backup_path = topic_path.with_suffix(topic_path.suffix + ".bak")
    fd, temp_name = tempfile.mkstemp(
        prefix=f".{topic_path.name}.",
        suffix=".tmp",
        dir=topic_path.parent,
        text=True,
    )

    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            json.dump(topic_data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        shutil.copy2(topic_path, backup_path)
        os.replace(temp_name, topic_path)
    except Exception:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
        raise


def save_topic_pair_data(
    chapter_dir: Path,
    first_filename: str,
    first_data: dict[str, Any],
    second_filename: str,
    second_data: dict[str, Any],
) -> None:
    """Validates and writes two related topic changes as one recoverable operation."""
    topic_updates = {
        first_filename: first_data,
        second_filename: second_data,
    }
    try:
        for topic_data in topic_updates.values():
            TopicFile.model_validate(topic_data)
    except ValidationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    result = validate_chapter_dir(
        chapter_dir=chapter_dir,
        static_dir=STATIC_DIR,
        topic_overrides=topic_updates,
    )
    if not result.is_valid:
        raise HTTPException(status_code=400, detail="; ".join(result.errors))

    paths = {filename: chapter_dir / filename for filename in topic_updates}
    original_contents = {
        filename: path.read_bytes() for filename, path in paths.items()
    }
    temp_paths: dict[str, str] = {}
    replaced_filenames: list[str] = []

    try:
        for filename, topic_data in topic_updates.items():
            topic_path = paths[filename]
            fd, temp_name = tempfile.mkstemp(
                prefix=f".{topic_path.name}.",
                suffix=".tmp",
                dir=topic_path.parent,
                text=True,
            )
            temp_paths[filename] = temp_name
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as file:
                json.dump(topic_data, file, ensure_ascii=False, indent=2)
                file.write("\n")

        for filename, topic_path in paths.items():
            shutil.copy2(topic_path, topic_path.with_suffix(topic_path.suffix + ".bak"))
            os.replace(temp_paths[filename], topic_path)
            replaced_filenames.append(filename)

    except Exception:
        for filename in replaced_filenames:
            topic_path = paths[filename]
            fd, rollback_name = tempfile.mkstemp(
                prefix=f".{topic_path.name}.rollback.",
                suffix=".tmp",
                dir=topic_path.parent,
            )
            try:
                with os.fdopen(fd, "wb") as file:
                    file.write(original_contents[filename])
                os.replace(rollback_name, topic_path)
            finally:
                if os.path.exists(rollback_name):
                    os.unlink(rollback_name)
        raise
    finally:
        for temp_name in temp_paths.values():
            if os.path.exists(temp_name):
                os.unlink(temp_name)


def save_meta_data(chapter_dir: Path, meta_data: dict[str, Any]) -> None:
    """Validates and atomically writes chapter metadata with a single backup."""
    try:
        ChapterMeta.model_validate(meta_data)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    meta_path = chapter_dir / "meta.json"
    backup_path = meta_path.with_suffix(meta_path.suffix + ".bak")
    fd, temp_name = tempfile.mkstemp(
        prefix=f".{meta_path.name}.",
        suffix=".tmp",
        dir=meta_path.parent,
        text=True,
    )

    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            json.dump(meta_data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        if meta_path.exists():
            shutil.copy2(meta_path, backup_path)
        os.replace(temp_name, meta_path)
    except Exception:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
        raise


def write_json_file(path: Path, data: dict[str, Any]) -> None:
    """Writes JSON using the same formatting as admin-edited content."""
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def get_chapter_question_ids(chapter_dir: Path) -> set[str]:
    """Returns all question IDs currently used in a chapter."""
    ids: set[str] = set()
    meta: ChapterMeta = load_chapter_meta(chapter_dir)
    for topic_filename in meta.topics:
        topic = load_topic_file(chapter_dir, topic_filename)
        ids.update(question.id for question in topic.questions)
    return ids


def generate_question_id(existing_ids: set[str]) -> str:
    """Generates a short chapter-unique question ID."""
    while True:
        question_id = f"q-{uuid.uuid4().hex[:8]}"
        if question_id not in existing_ids:
            return question_id


def generate_unique_slug(name: str, existing_values: set[str]) -> str:
    """Generates a readable slug unique within a small local namespace."""
    translated = name.translate(str.maketrans({"ł": "l", "Ł": "L"}))
    normalized = unicodedata.normalize("NFKD", translated)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = "".join(char if char.isalnum() else "-" for char in ascii_name).strip("-")
    slug = "-".join(part for part in slug.split("-") if part) or "item"

    candidate = slug
    index = 2
    while candidate in existing_values:
        candidate = f"{slug}-{index}"
        index += 1

    return candidate


def generate_topic_filename(topic_id: str, existing_filenames: set[str]) -> str:
    """Generates a topic filename matching the repository's existing style."""
    base_filename = f"topic_{len(existing_filenames) + 1}_{topic_id}.json"
    candidate = base_filename
    index = 2
    while candidate in existing_filenames:
        candidate = f"topic_{len(existing_filenames) + 1}_{topic_id}-{index}.json"
        index += 1
    return candidate
