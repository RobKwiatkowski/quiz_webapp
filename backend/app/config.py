"""Configuration objects and defaults for the backend app."""

from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent
CHAPTERS_DIR = BASE_DIR / "data" / "chapters"


class Settings:
    """Environment-driven settings container.

    Attributes:
        app_env: Runtime environment name (for example: ``dev`` or ``prod``).
        quiz_data_dir: Absolute path to chapter JSON files.
        admin_username: Single administrator login.
        admin_password_hash: Password hash for the single administrator.
        llm_questions_enabled: Whether learner quizzes include LLM questions.
    """

    app_env: str = os.getenv("APP_ENV", "dev")
    quiz_data_dir: str = os.getenv("QUIZ_DATA_DIR", str(CHAPTERS_DIR))
    admin_username: str = os.getenv("ADMIN_USERNAME", "")
    admin_password_hash: str = os.getenv("ADMIN_PASSWORD_HASH", "")
    llm_questions_enabled: bool = os.getenv("LLM_QUESTIONS_ENABLED", "true").strip().lower() not in {"false", "0", "no", "off"}


settings = Settings()
