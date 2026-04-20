import json
import random
from pathlib import Path

from app.config import settings
from app.models.quiz import ChapterMeta, Quiz, QuizListItem, TopicFile


def get_chapter_dirs() -> list[Path]:
    chapters_dir = Path(settings.quiz_data_dir)
    chapter_dirs = sorted([p for p in chapters_dir.iterdir() if p.is_dir()])
    print("CHAPTERS DIR:", chapters_dir)
    print("CHAPTER DIRS:", chapter_dirs)
    return chapter_dirs


def load_chapter_meta(chapter_dir: Path) -> ChapterMeta:
    meta_path = chapter_dir / "meta.json"
    with open(meta_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return ChapterMeta.model_validate(data)


def load_topic_file(chapter_dir: Path, topic_filename: str) -> TopicFile:
    topic_path = chapter_dir / topic_filename
    with open(topic_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return TopicFile.model_validate(data)


def build_quiz_from_chapter(chapter_dir: Path) -> Quiz:
    meta = load_chapter_meta(chapter_dir)

    selected_questions = []
    remaining_pool = []

    for topic_filename in meta.topics:
        topic = load_topic_file(chapter_dir, topic_filename)
        questions = topic.questions[:]
        random.shuffle(questions)

        selected_from_topic = questions[: meta.questions_per_topic]
        leftover_from_topic = questions[meta.questions_per_topic :]

        selected_questions.extend(selected_from_topic)
        remaining_pool.extend(leftover_from_topic)

    if len(selected_questions) < meta.target_question_count:
        missing = meta.target_question_count - len(selected_questions)
        random.shuffle(remaining_pool)
        selected_questions.extend(remaining_pool[:missing])

    random.shuffle(selected_questions)

    return Quiz(
        id=meta.id,
        title=meta.title,
        description=meta.description,
        category=meta.category,
        age_group=meta.age_group,
        questions=selected_questions,
    )


def load_all_quizzes() -> list[Quiz]:
    quizzes = []
    for chapter_dir in get_chapter_dirs():
        quizzes.append(build_quiz_from_chapter(chapter_dir))
    return quizzes


def load_quiz_list() -> list[QuizListItem]:
    return [
        QuizListItem(
            id=quiz.id,
            title=quiz.title,
            description=quiz.description,
            category=quiz.category,
            age_group=quiz.age_group,
        )
        for quiz in load_all_quizzes()
    ]


def load_quiz_by_id(quiz_id: str) -> Quiz | None:
    for quiz in load_all_quizzes():
        if quiz.id == quiz_id:
            print("MATCHED QUIZ:", quiz.id)
            print("MATCHED QUESTIONS COUNT:", len(quiz.questions))
            return quiz
    return None