# Edu Quiz for Kids - Project Specification

## 1. Product Goal

Edu Quiz for Kids is a lightweight educational quiz application for home learning,
designed for a child aged about 10-12. The first production version supports
single-player school revision without login, user profiles, rankings, or persisted
scores.

The application should be easy to run on a home server, including Raspberry Pi 3,
and should remain a separate service from the notes application.

Repository:
https://github.com/RobKwiatkowski/Quiz_webapp

## 2. Language Policy

The project language is English.

Use English for:

- source code comments and docstrings
- repository documentation
- project specifications
- agent instructions
- technical identifiers where practical

Use Polish only for:

- user-facing UI copy
- quiz questions, answers, accepted answers, explanations, and other learning content

This keeps the public GitHub repository approachable for contributors while keeping
the learning experience localized for the target child.

## 3. First Production Scope

In scope:

- quiz list page
- one quiz represents one school book chapter
- each chapter contains multiple topics
- each topic is stored in a separate JSON file
- backend assembles ready quiz payloads from chapter metadata and topic files
- frontend renders ready quiz data returned by the backend
- question types: `single`, `multiple`, and `open`
- optional source text passages on questions
- optional images on questions
- one question displayed at a time
- question display order grouped by the topic order declared in `meta.json`
- randomized answer order for closed questions
- immediate feedback after answering
- final score, percentage, and localized result message
- quiz restart after completion
- Enter key support on the quiz screen
- quiz content validator
- Docker Compose workflow with a static frontend served by Nginx and a FastAPI backend

Out of scope:

- login
- user profiles
- persisted scores
- database-backed content
- admin panel
- in-app question editor
- in-app image upload
- multiplayer mode
- live classroom sessions
- rankings
- timers
- retrying incorrect questions after the quiz
- advanced gamification

## 4. Architecture

The project consists of:

- FastAPI backend in `backend/app`
- static HTML/CSS/vanilla JavaScript frontend in `frontend`
- quiz content JSON files in `backend/app/data/chapters`
- static files, including local images, in `backend/app/static`
- Nginx configuration in `nginx/default.conf`
- Docker Compose workflow in `docker-compose.yml`

The backend is the source of ready quiz payloads. The frontend does not know the
chapter/topic file structure and does not assemble quizzes by itself.

## 5. Runtime and URLs

Default workflow:

```bash
docker compose up --build
```

Default ports from `docker-compose.yml`:

- frontend: `http://localhost:8081`
- backend API through frontend proxy: `http://localhost:8081/api`
- backend inside the Docker network: port `8000`

Nginx handles:

- `/` - static frontend
- `/api/` - proxy to the backend API
- `/health` - proxy to the backend health check
- `/static/` - proxy to backend static files

The frontend uses `CONFIG.API_BASE_URL`. The current default value is an empty
string, so API requests are relative and go through Nginx.

## 6. Backend

The backend exposes a small API and assembles quizzes from JSON files.

Endpoints:

- `GET /health` returns `{ "status": "ok" }`
- `GET /api/quizzes` returns lightweight quiz metadata without questions
- `GET /api/quizzes/{quiz_id}` returns a full quiz payload with questions
- unknown quiz IDs return `404` with `Quiz not found`

Configuration:

- `APP_ENV`, default: `dev`
- `QUIZ_DATA_DIR`, default: `backend/app/data/chapters`

The current backend allows CORS from any origin.

## 7. Data Models

Backend models are defined in `backend/app/models/quiz.py`.

### `Answer`

```json
{
  "text": "Answer label",
  "is_correct": true
}
```

Fields:

- `text`: answer label shown to the user
- `is_correct`: whether this answer is correct

### `Question`

```json
{
  "id": "unique-question-id",
  "text": "Question text",
  "source_text": null,
  "image": null,
  "explanation": "Feedback explanation",
  "selection_type": "single",
  "answers": [],
  "accepted_answers": []
}
```

Fields:

- `id`: question identifier, unique within a chapter
- `text`: question text
- `source_text`: optional source passage shown above the question; may be used
  with `single`, `multiple`, or `open` questions
- `image`: `null`, a `/static/...` path, or an `http://`/`https://` URL
- `explanation`: optional feedback text shown after an incorrect answer
- `selection_type`: `single`, `multiple`, or `open`
- `answers`: answer options for `single` and `multiple` questions
- `accepted_answers`: accepted values for `open` questions

The frontend contains partial support for an optional `case_sensitive` field on
open questions. This field is not part of the Pydantic model and is not validated,
so it must not be treated as a stable contract unless the model and validator are
updated.

### `TopicFile`

```json
{
  "topic_id": "topic",
  "topic_title": "Topic title",
  "questions": []
}
```

### `ChapterMeta`

```json
{
  "id": "history-chapter-6",
  "title": "Chapter title",
  "description": "Chapter revision quiz.",
  "category": "history",
  "age_group": "10-12",
  "target_question_count": 12,
  "questions_per_topic": 2,
  "topics": [
    "topic_1.json",
    "topic_2.json"
  ]
}
```

Fields:

- `id`: quiz/chapter identifier
- `title`: title shown on the list and quiz pages
- `description`: description shown in the UI
- `category`: category, for example `history`
- `age_group`: intended age group
- `target_question_count`: target number of questions in the final quiz, default `12`
- `questions_per_topic`: legacy field used by the model and validator, default `2`;
  the current loader does not use it when assembling quizzes
- `topics`: topic JSON files in the order used by the backend for base selection

## 8. Quiz Assembly

Quiz assembly logic lives in `backend/app/services/quiz_loader.py`.

For each chapter, the backend:

1. Loads `meta.json`.
2. Reads topic filenames from `topics`.
3. Returns an empty-question quiz if there are no topics.
4. Computes the base per-topic quota:

   ```python
   questions_per_topic = max(1, target_question_count // topic_count)
   ```

5. For each topic, in `meta.json` order:
   - loads the topic file
   - shuffles the topic questions
   - takes the base quota from the shuffled topic list
   - keeps remaining topic questions as fallback questions for that topic
6. If fewer than `target_question_count` questions were selected, the backend
   fills the missing slots from per-topic fallback questions while preserving
   the `meta.json` topic order.
7. The backend returns the final selected question list grouped by the topic
   order from `meta.json`.
8. The backend returns the assembled quiz.

If the available question pool is smaller than `target_question_count`, the quiz
will be shorter. If `target_question_count` is lower than the number of topics,
the current `max(1, ...)` rule can select more questions than the target because
the final list is not trimmed after the base selection step.

## 9. Frontend

The frontend is static and consists of:

- `frontend/index.html` - quiz list
- `frontend/quiz.html` - quiz screen and result screen
- `frontend/js/config.js` - API base URL configuration
- `frontend/js/api.js` - API calls
- `frontend/js/utils.js` - URL query parameters and shuffling
- `frontend/js/quiz-state.js` - current quiz session state
- `frontend/js/quiz-render.js` - question, feedback, and result rendering
- `frontend/js/quiz-check.js` - answer checking
- `frontend/js/quiz-events.js` - Enter key behavior
- `frontend/js/quiz-page.js` - initialization and restart flow

The frontend is responsible for:

- loading the quiz list
- loading the selected quiz by query-string `id`
- displaying one question at a time
- displaying optional source text above a question
- randomizing answer order for closed questions
- handling answer selection
- checking answers in the browser
- tracking the score in page memory
- showing the final result screen
- restarting the current quiz by fetching it from the backend again

The frontend does not persist scores and does not send user answers to the backend.

## 10. Answer Rules and Scoring

Each question is worth 1 point.

`single`:

- the user clicks one answer
- the answer is checked immediately
- exactly one answer must have `is_correct: true`
- after the answer is clicked, all answer buttons are locked

`multiple`:

- the user selects one or more answers
- the answer is checked after clicking the localized check button
- the result is correct only if the user selects all correct answers and no
  incorrect answers
- if nothing is selected, checking does not finish the question
- the UI shows a localized hint with the number of correct answers when it can be
  computed

`open`:

- the user types a short answer
- the answer is checked after clicking the localized check button or pressing Enter
- an empty answer shows a localized required-answer message
- the answer is compared against `accepted_answers`
- normalization includes:
  - trimming whitespace
  - lowercasing
  - removing trailing punctuation and trailing non-letter/non-number characters
  - replacing Polish diacritics with their plain ASCII equivalents

After a correct answer, the frontend shows a localized success message. After an
incorrect answer, it shows `explanation` if the question provides one.

## 11. Final Result

At the end of the quiz, the frontend shows:

- score as correct answers over total questions
- percentage
- localized result message
- result icon
- localized restart button

The final message is selected from localized UI copy based on the percentage:

- `< 50%`
- `>= 50%` and `< 75%`
- `>= 75%` and `< 90%`
- `>= 90%` and `< 100%`
- `100%`

## 12. Images

A question may have a local or remote image.

Allowed image references:

- `null` or missing field - no image
- `/static/...` - local backend static file
- `http://...` or `https://...` - remote image

For local images, the frontend builds the URL by joining `CONFIG.API_BASE_URL` and
the image path. With the current Nginx setup, `/static/...` works relative to the
same host.

The validator checks whether local files referenced by `/static/...` exist. It
does not fetch or validate remote URLs.

## 13. Content Validation

The validator is located at `backend/scripts/validate_quizzes.py`.

Recommended Windows command:

```powershell
py -3.12 backend/scripts/validate_quizzes.py
```

Fallback:

```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/validate_quizzes.ps1
```

The validator checks:

- chapter directory existence
- `meta.json` existence in every chapter directory
- required string fields in `meta.json`
- positive `questions_per_topic` and `target_question_count`
- non-empty `topics`
- no duplicate topic files in `topics`
- existence of every topic file referenced by `meta.json`
- required `topic_id`, `topic_title`, and `questions` fields
- no duplicate `topic_id` values within a chapter
- no duplicate question IDs within a topic or chapter
- valid `selection_type`
- optional `source_text` structure
- answer structure for `single` and `multiple`
- exactly one correct answer for `single`
- at least two correct answers for `multiple`
- non-empty `accepted_answers` for `open`
- local image path format and file existence

The validator emits warnings for content that can still run but is likely
inconsistent, such as fields that do not match the question type or a total
question count below the chapter target.

## 14. Quiz Authoring Rules

Quiz JSON files are the source of learning content and should remain easy to edit
manually.

Rules:

- each chapter has a separate directory in `backend/app/data/chapters`
- each chapter must have `meta.json`
- each topic is a separate JSON file referenced by `meta.json`
- question IDs must be unique within the whole chapter
- do not change the JSON schema without updating this specification, the backend
  models, and the validator
- source-based questions may add `source_text` while keeping the regular
  `selection_type` flow
- quiz content should be written for a child aged 10-12
- quiz content should be in Polish
- open questions should include all required variants in `accepted_answers`
- closed questions should usually have four answers, but the model only requires
  a valid answer list and the correct number of correct answers
- prefer ASCII-safe `topic_id`, filenames, and question IDs

The current repository contains one chapter directory:

- `backend/app/data/chapters/history-chapter-6`

## 15. UX

The interface should be:

- calm
- readable
- simple
- suitable for a child aged 10-12
- free of unnecessary elements

The current quiz screen shows:

- quiz title and description
- question counter
- progress bar and progress percentage
- optional question hint
- optional source text block
- question text
- optional image
- answers or text input
- feedback
- localized primary action button

Enter works globally on the quiz screen:

- if the next action is visible, Enter advances to the next question
- if the check action is visible, Enter checks the answer

## 16. Non-Functional Requirements

The project should remain:

- lightweight
- easy to run locally and on a home server
- easy to extend with more chapters
- JSON-backed until there is a real need for a database
- separated into backend, frontend, and content
- validated before quiz content changes are considered complete

## 17. Future Directions

Possible future extensions:

- more categories
- more chapters
- category-based quiz organization
- persisted results
- child profiles
- parent or teacher dashboard
- question editor
- image upload
- incorrect-answer retry mode
- timer mode
- database-backed content
- image attribution support for Wikimedia/Wikipedia images
- stricter production CORS settings
- encoding cleanup if Polish text display problems appear in content files

## 18. First Production Definition

The first production version is a working single-player quiz application that runs
through Docker Compose, shows a quiz list, loads a selected quiz from the backend,
supports `single`, `multiple`, and `open` questions, handles images, shows
immediate feedback and a final result, and keeps quiz content in validated chapter
and topic JSON files.
