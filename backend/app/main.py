"""Application entrypoint for the Edu Quiz backend API."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.admin import admin_pages_router, router as admin_router
from app.api.math import router as math_router
from app.api.quizzes import router as quizzes_router

app = FastAPI(title="Edu Quiz API")
APP_DIR = Path(__file__).resolve().parent

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(quizzes_router)
app.include_router(math_router)
app.include_router(admin_router)
app.include_router(admin_pages_router)

app.mount("/static", StaticFiles(directory=APP_DIR / "static"), name="static")
app.mount("/admin/assets", StaticFiles(directory=APP_DIR / "admin_static" / "assets"), name="admin-assets")


@app.get("/health")
def health():
    """Returns a minimal health-check payload.

    Returns:
        dict[str, str]: Service status payload.
    """
    return {"status": "ok"}
