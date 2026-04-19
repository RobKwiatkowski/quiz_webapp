import json
from pathlib import Path
from app.config import settings
from app.models.quiz import Quiz, QuizListItem


def get_quiz_files() -> list[Path]:
    quiz_dir = Path(settings.quiz_data_dir)
    files = sorted(quiz_dir.glob("*.json"))
    print("QUIZ DIR:", quiz_dir)
    print("QUIZ FILES:", files)
    return files


def load_all_quizzes() -> list[Quiz]:
    quizzes = []
    for file_path in get_quiz_files():
        print("READING FILE:", file_path)
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            print("RAW QUESTIONS COUNT:", len(data.get("questions", [])))
            quizzes.append(Quiz.model_validate(data))
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