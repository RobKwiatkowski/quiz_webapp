"""Validates chapter/topic quiz JSON files and static image references."""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "backend"
CHAPTERS_DIR = BACKEND_ROOT / "app" / "data" / "chapters"
STATIC_DIR = BACKEND_ROOT / "app" / "static"

sys.path.insert(0, str(BACKEND_ROOT))

from app.services.quiz_validation import validate_chapter_dir  # noqa: E402


def main() -> int:
    """Runs full validation for every chapter in the project."""
    errors: list[str] = []
    warnings: list[str] = []

    if not CHAPTERS_DIR.exists():
        print(f"ERROR: chapters directory does not exist: {CHAPTERS_DIR}")
        return 1

    chapter_dirs = sorted([p for p in CHAPTERS_DIR.iterdir() if p.is_dir()])
    if not chapter_dirs:
        print(f"ERROR: no chapter directories found in: {CHAPTERS_DIR}")
        return 1

    for chapter_dir in chapter_dirs:
        result = validate_chapter_dir(chapter_dir, STATIC_DIR)
        errors.extend(result.errors)
        warnings.extend(result.warnings)

    if warnings:
        print("WARNINGS:")
        for warning in warnings:
            print(f"  - {warning}")

    if errors:
        print("ERRORS:")
        for error in errors:
            print(f"  - {error}")
        return 1

    print("OK: all quiz files passed validation")
    return 0


if __name__ == "__main__":
    sys.exit(main())
