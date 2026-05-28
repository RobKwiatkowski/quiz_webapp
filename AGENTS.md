# Edu Quiz for Kids - Codex Instructions

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

## Language policy
- Use English for code comments, docstrings, documentation, specifications, and agent instructions.
- Use Polish only for user-facing UI copy and quiz learning content.
- Quiz learning content includes questions, answers, accepted answers, explanations, and related educational text.
- Prefer ASCII-safe technical identifiers, filenames, and slugs where practical.

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

## Quiz authoring
- For quiz content authoring, do not assume missing information.
- When the user asks to add or propose quiz questions, first present the proposed
  questions for review and wait for explicit approval before editing JSON files,
  unless the user clearly asks to implement immediately.
- When the user asks Codex to invent quiz questions, answers, distractors, or
  order/matching tasks, always present the proposed content for review and wait
  for explicit approval before editing JSON files.
- Ask clarifying questions first when question type, answer mode, target topic, or expected output format is unclear.
- Only propose missing distractors or accepted answers after explicitly asking for permission.
- For open questions, include natural accepted answer variants a child may type.
  This is especially important for dates and short history answers: include both
  bare dates and phrased forms such as `1795` and `w 1795`, and include common
  grammatical variants such as `z dynastii Burbonów`, `z Burbonów`, and `Burbonów`.
- For any task involving adding, editing, merging, or validating quiz questions in local JSON files, use the skill `quiz-question-authoring`.
- Keep the canonical skill in-repo at `skills/quiz-question-authoring/SKILL.md`.
- If `quiz-question-authoring` is not listed in the current session skills, load `skills/quiz-question-authoring/SKILL.md` directly and follow it as mandatory instructions instead of failing the task.
- If a global/user-level copy and the in-repo copy differ, prefer the in-repo copy.

## Python environment
- On Windows, do not use `python` directly.
- In Codex desktop/tool environments, prefer the bundled workspace Python
  runtime exposed by `load_workspace_dependencies` for Python commands.
- Use the bundled Python executable to run the validator:
  `<bundled-python> backend/scripts/validate_quizzes.py`.
- Outside Codex, use `py -3.12` for Python commands.
- Outside Codex, use `py -3.12 backend/scripts/validate_quizzes.py` to run the validator.
- If a command needs the venv, use `py -3.12 -m ...` unless the repo specifies otherwise.


## Python execution
- Do not assume `python` is available in PATH.
- In Codex sandbox or similar tool environments, call `load_workspace_dependencies`
  and use the returned bundled Python executable before trying local interpreters.
- In Codex, prefer:
  - `<bundled-python> backend/scripts/validate_quizzes.py`
- Outside Codex on Windows prefer:
  - `py -3.12 backend/scripts/validate_quizzes.py`
- If that fails, use:
  - `powershell -ExecutionPolicy Bypass -File backend/scripts/validate_quizzes.ps1`
- Do not rely on `.venv` unless it is confirmed working.
- If the bundled Python runtime is unavailable, clearly report that in the final
  response and then try the official local commands above.
- After using the bundled runtime for backend-affecting changes, also run
  lightweight sanity checks where practical, for example model parsing/imports
  and JavaScript syntax checks for touched frontend files.
