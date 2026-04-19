import os

class Settings:
    app_env: str = os.getenv("APP_ENV", "dev")
    quiz_data_dir: str = os.getenv("QUIZ_DATA_DIR", "/app/app/data/quizzes")

settings = Settings()