"""Utilities for loading chapter files and assembling quizzes."""

import json
import random
from pathlib import Path

from app.config import settings
from app.models.quiz import ChapterMeta, Question, Quiz, QuizListItem, TopicFile


def get_chapter_dirs() -> list[Path]:
    """Returns available chapter directories from the configured data path.

    Returns:
        list[Path]: Sorted chapter directory paths.
    """
    chapters_dir = Path(settings.quiz_data_dir)
    return sorted([p for p in chapters_dir.iterdir() if p.is_dir()])


def load_chapter_meta(chapter_dir: Path) -> ChapterMeta:
    """Loads and validates chapter metadata from ``meta.json``.

    Args:
        chapter_dir: Chapter directory path.

    Returns:
        ChapterMeta: Parsed chapter metadata model.
    """
    meta_path = chapter_dir / "meta.json"
    with open(meta_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return ChapterMeta.model_validate(data)


def load_topic_file(chapter_dir: Path, topic_filename: str) -> TopicFile:
    """Loads and validates a single topic JSON file.

    Args:
        chapter_dir: Chapter directory path.
        topic_filename: Topic JSON filename from chapter metadata.

    Returns:
        TopicFile: Parsed topic model with questions.
    """
    topic_path = chapter_dir / topic_filename
    with open(topic_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return TopicFile.model_validate(data)


def resolve_question_image(question: Question) -> Question:
    """Returns a question with one concrete image reference selected.

    Topic files may provide one image string or a list of image strings. The API
    response stays simple and always exposes a single image value or ``None``.
    """
    image = question.image

    if isinstance(image, list):
        selected_image = random.choice(image) if image else None
        return question.model_copy(update={"image": selected_image})

    return question


def calculate_century(year: int) -> int:
    """Returns the 1-based century for a non-zero BCE or CE year."""
    if year == 0:
        raise ValueError("Year zero does not belong to either era")
    return (abs(year) - 1) // 100 + 1


def to_roman(number: int) -> str:
    """Formats a positive integer as a Roman numeral for learner feedback."""
    numerals = (
        (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
        (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
        (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
    )
    result = []
    for value, symbol in numerals:
        while number >= value:
            result.append(symbol)
            number -= value
    return "".join(result)


def resolve_century_question(question: Question) -> Question:
    """Creates one concrete century question from its configured year range."""
    if question.selection_type != "century" or question.century_config is None:
        return question

    config = question.century_config
    year = random.randint(config.min_year, config.max_year)
    while year == 0:
        year = random.randint(config.min_year, config.max_year)

    century = calculate_century(year)
    era = "p.n.e." if year < 0 else "n.e."
    roman_century = to_roman(century)
    displayed_year = abs(year)

    return question.model_copy(
        update={
            "text": f"Rok {displayed_year} {era} Zapisz liczbą rzymską, który to wiek.",
            "explanation": f"Rok {displayed_year} {era} należy do {roman_century} wieku {era}",
            "century_year": year,
            "correct_century": century,
        }
    )


def build_quiz_from_chapter(chapter_dir: Path) -> Quiz:
    """Builds a quiz by distributing picks across all chapter topics.

    Selection strategy:
    1. Compute equal per-topic quota from ``target_question_count``.
    2. Shuffle each topic and take quota-sized picks.
    3. Backfill missing questions from leftovers, preserving topic order.
    4. Return selected questions grouped by ``meta.json`` topic order.

    Args:
        chapter_dir: Chapter directory path.

    Returns:
        Quiz: Fully assembled quiz payload.
    """
    meta = load_chapter_meta(chapter_dir)

    topic_filenames = meta.topics
    topic_count = len(topic_filenames)

    if topic_count == 0:
        return Quiz(
            id=meta.id,
            title=meta.title,
            description=meta.description,
            category=meta.category,
            age_group=meta.age_group,
            chapter_number=meta.chapter_number,
            questions=[],
        )

    questions_per_topic = max(1, meta.target_question_count // topic_count)

    selected_by_topic = []
    leftovers_by_topic = []
    selected_question_count = 0

    for topic_filename in topic_filenames:
        topic = load_topic_file(chapter_dir, topic_filename)
        topic_questions = topic.questions[:]
        random.shuffle(topic_questions)

        selected_from_topic = topic_questions[:questions_per_topic]
        leftover_from_topic = topic_questions[questions_per_topic:]

        selected_by_topic.append(selected_from_topic)
        leftovers_by_topic.append(leftover_from_topic)
        selected_question_count += len(selected_from_topic)

    while selected_question_count < meta.target_question_count:
        added_question = False

        for topic_questions, leftover_questions in zip(selected_by_topic, leftovers_by_topic):
            if selected_question_count >= meta.target_question_count:
                break

            if leftover_questions:
                topic_questions.append(leftover_questions.pop(0))
                selected_question_count += 1
                added_question = True

        if not added_question:
            break

    selected_questions = [
        resolve_century_question(resolve_question_image(question))
        for topic_questions in selected_by_topic
        for question in topic_questions
    ]

    return Quiz(
        id=meta.id,
        title=meta.title,
        description=meta.description,
        category=meta.category,
        age_group=meta.age_group,
        chapter_number=meta.chapter_number,
        questions=selected_questions,
    )


def load_all_quizzes() -> list[Quiz]:
    """Loads and builds quizzes for all available chapters.

    Returns:
        list[Quiz]: Built quizzes for all chapter directories.
    """
    return [build_quiz_from_chapter(chapter_dir) for chapter_dir in get_chapter_dirs()]


def load_quiz_list() -> list[QuizListItem]:
    """Builds lightweight quiz cards for the list endpoint.

    Returns:
        list[QuizListItem]: Quiz metadata without full question payloads.
    """
    return [
        QuizListItem(
            id=quiz.id,
            title=quiz.title,
            description=quiz.description,
            category=quiz.category,
            age_group=quiz.age_group,
            chapter_number=quiz.chapter_number,
        )
        for quiz in load_all_quizzes()
    ]


def load_quiz_by_id(quiz_id: str) -> Quiz | None:
    """Finds and returns a quiz by its identifier.

    Args:
        quiz_id: Unique quiz identifier.

    Returns:
        Quiz | None: Matching quiz when found, otherwise ``None``.
    """
    for quiz in load_all_quizzes():
        if quiz.id == quiz_id:
            return quiz
    return None
