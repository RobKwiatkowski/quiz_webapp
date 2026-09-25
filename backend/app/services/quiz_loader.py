"""Utilities for loading chapter files and assembling quizzes."""

import json
import random
from pathlib import Path
from typing import Literal

from app.config import settings
from app.models.quiz import ChapterMeta, Question, Quiz, QuizListItem, TopicFile
from app.services.math.operation_order import resolve_operation_order_question

Difficulty = Literal["easy", "medium", "pro"]


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


def calculate_century_half(year: int) -> Literal["first", "second"]:
    """Returns the chronological half of a non-zero BCE or CE year."""
    if year == 0:
        raise ValueError("Year zero does not belong to either era")

    if year > 0:
        position_in_century = (year - 1) % 100 + 1
    else:
        # BCE years count down: 500 BCE starts the fifth century, while
        # 401 BCE ends it. Convert that reversed numbering to positions 1-100.
        position_in_century = 100 - ((abs(year) - 1) % 100)

    return "first" if position_in_century <= 50 else "second"


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
    century_half = calculate_century_half(year)
    era = "p.n.e." if year < 0 else "n.e."
    roman_century = to_roman(century)
    half_label = "I" if century_half == "first" else "II"
    displayed_year = abs(year)

    return question.model_copy(
        update={
            "text": (
                f"Rok {displayed_year} {era} Zapisz liczbą rzymską, który to wiek, "
                "i wybierz połowę tego wieku."
            ),
            "explanation": (
                f"Rok {displayed_year} {era} to {half_label} połowa "
                f"{roman_century} wieku {era}"
            ),
            "century_year": year,
            "correct_century": century,
            "correct_century_half": century_half,
        }
    )


def resolve_written_multiplication_question(
    question: Question,
    used_pairs: set[tuple[int, int]],
    difficulty: Difficulty,
) -> Question:
    """Creates concrete, non-repeated operands for a multiplication template."""
    if (
        question.selection_type != "written_multiplication"
        or question.written_multiplication_config is None
    ):
        return question

    config = question.written_multiplication_config
    total_digit_limit = config.easy_max_total_digits if difficulty != "pro" else config.max_total_digits
    digit_lengths = range(len(str(config.min_factor)), len(str(config.max_factor)) + 1)
    length_pairs = [
        (multiplicand_digits, multiplier_digits)
        for multiplicand_digits in digit_lengths
        for multiplier_digits in digit_lengths
        if multiplicand_digits + multiplier_digits <= total_digit_limit
    ]

    def generate_pair() -> tuple[int, int]:
        multiplicand_digits, multiplier_digits = random.choice(length_pairs)
        multiplicand = random.randint(
            max(config.min_factor, 10 ** (multiplicand_digits - 1)),
            min(config.max_factor, 10**multiplicand_digits - 1),
        )
        multiplier = random.randint(
            max(config.min_factor, 10 ** (multiplier_digits - 1)),
            min(config.max_factor, 10**multiplier_digits - 1),
        )
        return multiplicand, multiplier

    if difficulty != "pro":
        candidates = []
        for _ in range(1000):
            candidate = generate_pair()
            multiplicand, multiplier = candidate
            partial_products = [multiplicand * int(digit) for digit in str(multiplier)]
            if max(partial_products, default=0) <= config.easy_max_partial_product:
                candidates.append(candidate)
        if not candidates:
            raise ValueError("written multiplication easy settings cannot generate a question")
        unused_candidates = [candidate for candidate in candidates if candidate not in used_pairs]
        pair = random.choice(unused_candidates or candidates)
    else:
        pair = generate_pair()
        for _ in range(50):
            if pair not in used_pairs:
                break
            pair = generate_pair()
    used_pairs.add(pair)

    multiplicand, multiplier = pair
    return question.model_copy(
        update={
            "multiplicand": multiplicand,
            "multiplier": multiplier,
            "explanation": (
                f"{multiplicand} × {multiplier} = {multiplicand * multiplier}. "
                "Sprawdź wyniki cząstkowe i ich przesunięcie o kolejne miejsca."
            ),
        }
    )


def resolve_timed_multiplication_question(
    question: Question,
    used_pairs: set[tuple[int, int]],
) -> Question:
    """Creates one non-repeated multiplication-table operation."""
    if (
        question.selection_type != "timed_multiplication"
        or question.timed_multiplication_config is None
    ):
        return question

    config = question.timed_multiplication_config

    def generate_pair() -> tuple[int, int]:
        first = random.randint(config.min_factor, config.max_factor)
        second = random.randint(config.min_factor, config.max_factor)
        return first, second

    pair = generate_pair()
    for _ in range(100):
        normalized_pair = tuple(sorted(pair))
        if normalized_pair not in used_pairs:
            break
        pair = generate_pair()
    used_pairs.add(tuple(sorted(pair)))

    multiplicand, multiplier = pair
    return question.model_copy(
        update={
            "multiplicand": multiplicand,
            "multiplier": multiplier,
            "explanation": f"{multiplicand} × {multiplier} = {multiplicand * multiplier}.",
        }
    )


def resolve_timed_division_question(
    question: Question,
    used_pairs: set[tuple[int, int]],
) -> Question:
    """Creates one non-repeated exact division-table operation."""
    if question.selection_type != "timed_division" or question.timed_division_config is None:
        return question

    config = question.timed_division_config

    def generate_pair() -> tuple[int, int]:
        divisor = random.randint(config.min_divisor, config.max_divisor)
        quotient = random.randint(config.min_quotient, config.max_quotient)
        return divisor, quotient

    pair = generate_pair()
    for _ in range(100):
        if pair not in used_pairs:
            break
        pair = generate_pair()
    used_pairs.add(pair)

    divisor, quotient = pair
    dividend = divisor * quotient
    return question.model_copy(
        update={
            "dividend": dividend,
            "divisor": divisor,
            "quotient": quotient,
            "explanation": f"{dividend} : {divisor} = {quotient}.",
        }
    )


def resolve_written_division_question(
    question: Question,
    used_pairs: set[tuple[int, int]],
    difficulty: Difficulty,
) -> Question:
    """Creates concrete operands for exact division with no remainder."""
    if question.selection_type != "written_division" or question.written_division_config is None:
        return question

    config = question.written_division_config
    if difficulty == "easy":
        min_divisor = config.easy_min_divisor
        max_divisor = config.easy_max_divisor
    elif difficulty == "medium":
        min_divisor = config.medium_min_divisor
        max_divisor = config.medium_max_divisor
    else:
        min_divisor = config.min_divisor
        max_divisor = config.max_divisor
    max_quotient = config.easy_max_quotient if difficulty != "pro" else config.max_quotient
    max_dividend_digits = config.easy_max_dividend_digits if difficulty != "pro" else config.max_dividend_digits
    divisor_lengths = range(len(str(min_divisor)), len(str(max_divisor)) + 1)
    quotient_lengths = range(len(str(config.min_quotient)), len(str(max_quotient)) + 1)
    length_pairs = [
        (divisor_digits, quotient_digits)
        for divisor_digits in divisor_lengths
        for quotient_digits in quotient_lengths
        if divisor_digits + quotient_digits <= max_dividend_digits
    ]

    def generate_pair() -> tuple[int, int]:
        divisor_digits, quotient_digits = random.choice(length_pairs)
        divisor = random.randint(
            max(min_divisor, 10 ** (divisor_digits - 1)),
            min(max_divisor, 10**divisor_digits - 1),
        )
        quotient = random.randint(
            max(config.min_quotient, 10 ** (quotient_digits - 1)),
            min(max_quotient, 10**quotient_digits - 1),
        )
        return divisor, quotient

    if difficulty != "pro":
        candidates = []
        for divisor in range(min_divisor, max_divisor + 1):
            for quotient in range(config.min_quotient, max_quotient + 1):
                dividend = divisor * quotient
                if len(str(dividend)) > max_dividend_digits:
                    continue
                intermediate_values = calculate_division_intermediate_values(dividend, divisor)
                if intermediate_values and max(intermediate_values) <= config.easy_max_intermediate_value:
                    candidates.append((divisor, quotient))
        if not candidates:
            raise ValueError(f"written division {difficulty} settings cannot generate a question")
        unused_candidates = [candidate for candidate in candidates if candidate not in used_pairs]
        pair = random.choice(unused_candidates or candidates)
    else:
        pair = generate_pair()
        for _ in range(50):
            if pair not in used_pairs:
                break
            pair = generate_pair()
    used_pairs.add(pair)

    divisor, quotient = pair
    dividend = divisor * quotient
    return question.model_copy(
        update={
            "dividend": dividend,
            "divisor": divisor,
            "quotient": quotient,
            "explanation": (
                f"{dividend} : {divisor} = {quotient}. "
                "W każdym kroku odejmij iloczyn dzielnika i kolejnej cyfry ilorazu."
            ),
        }
    )


def calculate_division_intermediate_values(dividend: int, divisor: int) -> list[int]:
    """Returns every displayed value created by the written-division algorithm."""
    values: list[int] = []
    remainder = 0
    quotient_started = False

    for digit in str(dividend):
        partial_dividend = remainder * 10 + int(digit)
        if not quotient_started and partial_dividend < divisor:
            remainder = partial_dividend
            continue

        quotient_started = True
        subtraction = (partial_dividend // divisor) * divisor
        remainder = partial_dividend - subtraction
        values.extend([partial_dividend, subtraction, remainder])

    return values


def build_quiz_from_chapter(chapter_dir: Path, difficulty: Difficulty = "easy") -> Quiz:
    """Builds a quiz by distributing picks across active chapter topics.

    Selection strategy:
    1. Compute equal per-topic quota from ``target_question_count``.
    2. Shuffle each active topic and take quota-sized picks.
    3. Backfill missing questions from leftovers, preserving topic order.
    4. Return selected questions grouped by ``meta.json`` topic order.

    Args:
        chapter_dir: Chapter directory path.

    Returns:
        Quiz: Fully assembled quiz payload.
    """
    meta = load_chapter_meta(chapter_dir)

    active_topics = [
        (topic_filename, topic)
        for topic_filename in meta.topics
        if (topic := load_topic_file(chapter_dir, topic_filename)).is_active
    ]
    topic_count = len(active_topics)

    if topic_count == 0:
        return Quiz(
            id=meta.id,
            title=meta.title,
            description=meta.description,
            category=meta.category,
            age_group=meta.age_group,
            chapter_number=meta.chapter_number,
            difficulty_levels=meta.difficulty_levels,
            questions=[],
        )

    questions_per_topic = max(1, meta.target_question_count // topic_count)

    selected_by_topic = []
    leftovers_by_topic = []
    selected_question_count = 0

    for _topic_filename, topic in active_topics:
        topic_questions = [question for question in topic.questions if question.is_active]
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

    used_multiplication_pairs: set[tuple[int, int]] = set()
    used_division_pairs: set[tuple[int, int]] = set()
    used_timed_multiplication_pairs: set[tuple[int, int]] = set()
    used_timed_division_pairs: set[tuple[int, int]] = set()
    used_operation_order_expressions: set[str] = set()
    selected_questions = [
        resolve_operation_order_question(
            resolve_timed_division_question(
                resolve_timed_multiplication_question(
                    resolve_written_division_question(
                        resolve_written_multiplication_question(
                            resolve_century_question(resolve_question_image(question)),
                            used_multiplication_pairs,
                            difficulty,
                        ),
                        used_division_pairs,
                        difficulty,
                    ),
                    used_timed_multiplication_pairs,
                ),
                used_timed_division_pairs,
            ),
            used_operation_order_expressions,
            difficulty,
        )
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
        difficulty_levels=meta.difficulty_levels,
        questions=selected_questions,
    )


def load_all_quizzes(difficulty: Difficulty = "easy") -> list[Quiz]:
    """Loads and builds quizzes for all available chapters.

    Returns:
        list[Quiz]: Built quizzes for all chapter directories.
    """
    return [build_quiz_from_chapter(chapter_dir, difficulty) for chapter_dir in get_chapter_dirs()]


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
            difficulty_levels=quiz.difficulty_levels,
        )
        for quiz in load_all_quizzes()
    ]


def load_quiz_by_id(quiz_id: str, difficulty: Difficulty = "easy") -> Quiz | None:
    """Finds and returns a quiz by its identifier.

    Args:
        quiz_id: Unique quiz identifier.

    Returns:
        Quiz | None: Matching quiz when found, otherwise ``None``.
    """
    for quiz in load_all_quizzes(difficulty):
        if quiz.id == quiz_id:
            return quiz
    return None
