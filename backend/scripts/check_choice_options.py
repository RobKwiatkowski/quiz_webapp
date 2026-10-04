"""Check the four-option authoring rule for selected quiz questions."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def check_options(options: object, context: str) -> list[str]:
    """Return errors for a choice list with fewer than four distinct labels."""
    if not isinstance(options, list):
        return [f"{context}: options must be a list"]

    labels = [
        item.get("text") if isinstance(item, dict) else item
        for item in options
    ]
    if any(not isinstance(label, str) or not label.strip() for label in labels):
        return [f"{context}: every option must have non-empty text"]

    distinct = {label.strip().casefold() for label in labels}
    if len(labels) < 4 or len(distinct) < 4:
        return [f"{context}: at least four distinct options are required"]
    return []


def main() -> int:
    """Check whole topic files or only newly authored question IDs."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("topics", nargs="+", type=Path, help="Topic JSON files to check")
    parser.add_argument(
        "--question-id",
        action="append",
        dest="question_ids",
        help="Check only this newly authored question ID; repeat as needed",
    )
    args = parser.parse_args()

    wanted = set(args.question_ids or [])
    found: set[str] = set()
    errors: list[str] = []
    checked_lists = 0

    for topic_path in args.topics:
        try:
            topic = json.loads(topic_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{topic_path}: {exc}")
            continue

        for question in topic.get("questions", []):
            question_id = question.get("id", "<missing ID>")
            if wanted and question_id not in wanted:
                continue
            found.add(question_id)
            context = f"{topic_path} -> question[{question_id}]"
            selection_type = question.get("selection_type")
            map_config = question.get("map_config") or {}

            if selection_type in {"single", "multiple"} or (
                selection_type == "map" and map_config.get("mode") == "identify"
            ):
                checked_lists += 1
                errors.extend(check_options(question.get("answers"), context))
            elif selection_type == "fill" and question.get("fill_mode") == "select":
                for blank in question.get("fill_blanks", []):
                    checked_lists += 1
                    errors.extend(
                        check_options(
                            blank.get("options"),
                            f"{context} -> blank[{blank.get('id', '<missing ID>')}]",
                        )
                    )

    for missing_id in sorted(wanted - found):
        errors.append(f"Question ID not found: {missing_id}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print(f"OK: {checked_lists} choice lists have at least four distinct options")
    return 0


if __name__ == "__main__":
    sys.exit(main())
