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


def list_admin_chapters(subject: str | None = None) -> list[dict[str, str]]:
    """Returns chapters available for admin editing."""
    if subject is not None:
        subject = normalize_subject(subject)

    chapters = []
    chapters_dir = Path(settings.quiz_data_dir)
    for chapter_dir in sorted([p for p in chapters_dir.iterdir() if p.is_dir()]):
        meta = load_chapter_meta(chapter_dir)
        if subject and meta.category != subject:
            continue
        chapters.append({"id": meta.id, "title": meta.title, "subject": meta.category})
    return chapters


def create_chapter(payload: dict[str, Any]) -> dict[str, str]:
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

    return {"id": chapter_id, "title": name, "subject": subject}


def normalize_subject(value: Any) -> str:
    """Validates and returns a supported admin subject identifier."""
    subject = str(value or "").strip()
    if subject not in SUPPORTED_SUBJECTS:
        raise HTTPException(status_code=400, detail="Unsupported subject")
    return subject


def get_topic_filename(chapter_dir: Path, topic_id: str) -> str:
    """Resolves a topic ID to its JSON filename inside a chapter."""
    meta = load_chapter_meta(chapter_dir)
    for topic_filename in meta.topics:
        topic = load_topic_file(chapter_dir, topic_filename)
        if topic.topic_id == topic_id:
            return topic_filename
    raise HTTPException(status_code=404, detail="Topic not found")


def list_admin_topics(chapter_id: str) -> list[dict[str, str]]:
    """Returns topic titles for an existing chapter."""
    chapter_dir = get_chapter_dir(chapter_id)
    meta = load_chapter_meta(chapter_dir)
    topics = []
    for topic_filename in meta.topics:
        topic = load_topic_file(chapter_dir, topic_filename)
        topics.append({"id": topic.topic_id, "title": topic.topic_title})
    return topics


def create_topic(chapter_id: str, payload: dict[str, Any]) -> dict[str, str]:
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
    topic_data = {"topic_id": topic_id, "topic_title": name, "questions": []}

    TopicFile.model_validate(topic_data)
    meta_data["topics"] = [*meta_data.get("topics", []), topic_filename]
    ChapterMeta.model_validate(meta_data)

    write_json_file(chapter_dir / topic_filename, topic_data)
    save_meta_data(chapter_dir, meta_data)

    return {"id": topic_id, "title": name}


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
            questions[index] = question
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


def normalize_admin_question(
    payload: dict[str, Any],
    question_id: str,
    chapter_id: str,
    topic_id: str,
) -> dict[str, Any]:
    """Keeps the stored question payload small and type-specific."""
    selection_type = payload.get("selection_type", "single")
    question: dict[str, Any] = {
        "id": question_id,
        "topic_id": topic_id,
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

    if selection_type in {"single", "multiple"}:
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
    else:
        raise HTTPException(
            status_code=400,
            detail="Admin supports only single, multiple, open, llm, order, and matching questions",
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
        return save_uploaded_question_image(image_upload, question_id, chapter_id, topic_id)

    return image_value


def save_uploaded_question_image(
    image_upload: Any,
    question_id: str,
    chapter_id: str,
    topic_id: str,
) -> str:
    """Stores an admin-uploaded image under backend static files."""
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

    chapter_slug = generate_unique_slug(chapter_id, set())
    topic_slug = generate_unique_slug(topic_id, set())
    question_slug = generate_unique_slug(question_id, set())
    upload_dir = STATIC_DIR / "images" / "admin" / chapter_slug / topic_slug
    upload_dir.mkdir(parents=True, exist_ok=True)

    target_name = f"{question_slug}{extension}"
    target_path = upload_dir / target_name
    suffix = 2
    while target_path.exists():
        target_name = f"{question_slug}-{suffix}{extension}"
        target_path = upload_dir / target_name
        suffix += 1

    with open(target_path, "wb") as f:
        f.write(image_bytes)

    return f"/static/images/admin/{chapter_slug}/{topic_slug}/{target_name}"


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
