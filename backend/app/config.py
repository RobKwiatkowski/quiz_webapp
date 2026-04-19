from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent
QUIZ_DIR = BASE_DIR / "data" / "quizzes"

class Settings:
    app_env: str = os.getenv("APP_ENV", "dev")
    quiz_data_dir: str = os.getenv("QUIZ_DATA_DIR", str(QUIZ_DIR))

settings = Settings()