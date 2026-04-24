---
name: quiz-question-authoring
description: Add, edit, merge, validate, and organize local Edu Quiz topic JSON files. Use this when tasks mention creating or editing quiz questions, topic_*.json files, chapter meta.json, accepted_answers, distractors, question IDs, or quiz JSON schema validation in backend/app/data/chapters/**.
---

# When to use
Use this skill when the task involves:
- adding new quiz questions
- rewriting existing questions
- merging topic JSON files
- checking question format
- preparing chapter/topic content for the quiz app

# Read first
Before editing, read:
- docs/spec.md
- backend/app/models/quiz.py
- backend/app/services/quiz_loader.py
- backend/scripts/validate_quizzes.py
- target chapter meta.json
- target topic JSON files

# Project rules
- One quiz = one book chapter
- One topic = one JSON file
- Keep JSON schema consistent with backend models
- Preserve support for single, multiple, and open questions
- For open questions, use accepted_answers
- Do not add answers: [] to open questions unless explicitly required
- Prefer ASCII-safe ids for topic_id, file names, and question ids
- Question ids must be unique within a chapter
- Keep language simple for a child aged 10-11
- Keep project documentation and agent instructions in English
- Keep quiz learning content in Polish unless the user explicitly requests another language

# Authoring rules
- single: exactly 1 correct answer
- multiple: at least 2 correct answers
- open: accepted_answers must be non-empty
- images may be local /static/... paths or remote URLs
- keep explanations short and clear
- avoid duplicate questions across topics

# Output rules
When editing files:
1. update the correct topic JSON
2. preserve valid formatting
3. report what was added or changed
4. run the validator if available

# Interaction mode
When creating quiz questions, use a clarification-first workflow.

If any of the following are missing, ask first:
- target chapter
- target topic file
- question type: single / multiple / open
- whether the user wants to provide all answers manually
- whether Codex should propose distractors for closed questions
- whether Codex should propose accepted_answers for open questions
- whether an image should be used

## Closed questions workflow
If the user provides only the correct answer:
- ask: "Do you want to provide the remaining answer options yourself, or should I propose them?"

If the user says Codex should propose them:
- generate plausible distractors
- keep only one correct answer for single
- keep at least two correct answers for multiple

## Open questions workflow
If the user provides the main answer only:
- ask: "Do you want to provide accepted answer variants yourself, or should I propose them?"

If the user says Codex should propose them:
- create short accepted_answers variants
- keep them simple and age-appropriate

## Never assume silently
If the format is unclear, ask instead of guessing.
