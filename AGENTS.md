# Edu Quiz for Kids — Codex Instructions

## Source of truth
Before making meaningful changes, read:
- `docs/spec.md`
- `backend/app/models/quiz.py`
- `backend/app/services/quiz_loader.py`

For quiz content changes, also read:
- `backend/app/data/chapters/**/meta.json`
- `backend/app/data/chapters/**/*.json`

## Project rules
- This project follows specification-driven development.
- Keep implementation aligned with `docs/spec.md`.
- If code and spec conflict, do not silently choose one. Point out the conflict.
- Prefer small, focused changes.
- Do not change JSON schema, quiz flow, or selection logic without updating `docs/spec.md`.

## Backend rules
- Quiz assembly logic belongs in backend, not frontend.
- Question selection is driven by chapter metadata and topic files.
- Preserve support for `single`, `multiple`, and `open` question types.

## Frontend rules
- Frontend renders ready quiz data from backend.
- Keep JS modular and easy to read.
- Do not add new UI complexity unless requested.

## Validation
Before finishing:
- run the quiz validator
- check that no question ids collide inside a chapter
- check that referenced topic files exist