"""Move legacy admin-uploaded images into each chapter's reusable image folder.

Run from the project root with the configured Python runtime:
    <python> backend/scripts/migrate_admin_images.py
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "backend"
CHAPTERS_DIR = BACKEND_ROOT / "app" / "data" / "chapters"

sys.path.insert(0, str(BACKEND_ROOT))

from app.services import admin_content  # noqa: E402


LEGACY_PREFIX = "/static/images/admin/"


def target_path(source: Path, destination_dir: Path) -> Path:
    """Returns an unused destination path while preserving a readable filename."""
    candidate = destination_dir / source.name
    suffix = 2
    while candidate.exists():
        candidate = destination_dir / f"{source.stem}-{suffix}{source.suffix}"
        suffix += 1
    return candidate


def update_backup_paths(topic_path: Path, replacements: dict[str, str]) -> None:
    """Keeps the one-file recovery backup usable after moving image files."""
    backup_path = topic_path.with_suffix(topic_path.suffix + ".bak")
    if not backup_path.exists():
        return

    content = backup_path.read_text(encoding="utf-8")
    for old_path, new_path in replacements.items():
        content = content.replace(f'"{old_path}"', f'"{new_path}"')
    backup_path.write_text(content, encoding="utf-8")


def move_chapter_images(chapter_id: str) -> tuple[int, int]:
    """Moves one chapter's referenced legacy files and rewrites topic paths."""
    chapter_dir = admin_content.get_chapter_dir(chapter_id)
    meta = admin_content.load_chapter_meta(chapter_dir)
    default_folder = Path(admin_content.list_admin_images(chapter_id)["default_folder"])
    destination_dir = admin_content.STATIC_DIR / "images" / default_folder
    replacements: dict[str, str] = {}
    moved = 0

    for topic_filename in meta.topics:
        topic_path = chapter_dir / topic_filename
        topic_data = json.loads(topic_path.read_text(encoding="utf-8"))
        changed = False

        for question in topic_data.get("questions", []):
            image = question.get("image")
            values = image if isinstance(image, list) else [image]
            rewritten_values: list[object] = []
            for value in values:
                if not isinstance(value, str) or not value.startswith(LEGACY_PREFIX):
                    rewritten_values.append(value)
                    continue

                if value not in replacements:
                    source = admin_content.STATIC_DIR / value.removeprefix("/static/")
                    if not source.is_file():
                        print(f"WARNING: missing referenced image: {source}")
                        rewritten_values.append(value)
                        continue
                    destination_dir.mkdir(parents=True, exist_ok=True)
                    destination = target_path(source, destination_dir)
                    shutil.move(source, destination)
                    replacements[value] = f"/static/images/{default_folder.as_posix()}/{destination.name}"
                    moved += 1

                rewritten_values.append(replacements.get(value, value))

            rewritten_image: object = rewritten_values if isinstance(image, list) else rewritten_values[0]
            if rewritten_image != image:
                question["image"] = rewritten_image
                changed = True

        if changed:
            admin_content.save_topic_data(chapter_dir, topic_filename, topic_data)
            update_backup_paths(topic_path, replacements)

    legacy_folder = admin_content.STATIC_DIR / "images" / "admin" / admin_content.generate_unique_slug(chapter_id, set())
    if legacy_folder.exists():
        for source in sorted(path for path in legacy_folder.rglob("*") if path.is_file()):
            destination_dir.mkdir(parents=True, exist_ok=True)
            shutil.move(source, target_path(source, destination_dir))
            moved += 1
        for directory in sorted((path for path in legacy_folder.rglob("*") if path.is_dir()), reverse=True):
            directory.rmdir()
        legacy_folder.rmdir()

    return moved, len(replacements)


def main() -> int:
    """Migrates all legacy image references under the quiz data directory."""
    moved_total = 0
    chapter_count = 0
    for chapter_dir in sorted(path for path in CHAPTERS_DIR.iterdir() if path.is_dir()):
        moved, _ = move_chapter_images(chapter_dir.name)
        moved_total += moved
        chapter_count += int(moved > 0)

    print(f"Moved {moved_total} image(s) in {chapter_count} chapter(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
