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
    """

    app_env: str = os.getenv("APP_ENV", "dev")
    quiz_data_dir: str = os.getenv("QUIZ_DATA_DIR", str(CHAPTERS_DIR))


settings = Settings()
