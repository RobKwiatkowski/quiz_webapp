# Edu Quiz for Kids - Project Specification

## 1. Product Goal

Edu Quiz for Kids is a lightweight educational quiz application for home learning,
designed for a child aged about 10-12. The first production version supports
single-player school revision, plus a minimal single-admin authoring panel for
editing JSON-backed questions.

The application should be easy to run on a home server, including Raspberry Pi 3,
and should remain a separate service from the notes application.

Repository:
https://github.com/RobKwiatkowski/quiz_webapp

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
- each playable chapter contains one or more topics; a newly created admin
  chapter may temporarily contain no topics
- each topic is stored in a separate JSON file
- backend assembles ready quiz payloads from chapter metadata and topic files
- frontend renders ready quiz data returned by the backend
- question types: `single`, `multiple`, `open`, `llm`, `order`, and `matching`
- optional source text passages on questions
- optional structured context passages with source attribution on questions
- optional images on questions, including multiple alternative images for one
  question
- image questions authored from an internet image URL or a local admin-uploaded
  image file
- multi-slot open questions
- point-based scoring derived from question structure
- minimal admin login with a signed session cookie
- admin question editor for existing chapters and topics
- creating new chapters and topics from the admin panel
- creating, editing, and deleting questions in existing topic JSON files
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

- user profiles
- persisted scores
- database-backed content
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

Docker Compose builds only the backend image. The frontend uses the official
`nginx:stable-alpine` image with `frontend/` and `nginx/default.conf`
bind-mounted into the container to keep rebuilds lightweight on Raspberry Pi.

The repository also supports publishing a production frontend image for
container-only deployments. The image serves the static frontend with Nginx and
generates `js/config.js` from the `API_BASE_URL` environment variable at startup.
This is intended for Raspberry Pi deployments where Caddy routes traffic to
internal frontend and backend containers.

For the current Raspberry Pi deployment used for this project, deployment files
are stored under `/opt` rather than `/home`.

The backend is the source of ready quiz payloads. The frontend does not know the
chapter/topic file structure and does not assemble quizzes by itself.

## 5. Runtime and URLs

Default workflow:

```bash
docker compose up --build
```

The `--build` flag rebuilds the backend when needed. The frontend is not rebuilt
as a custom image in the default Compose workflow.

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
- `GET /api/math/question` returns a placeholder LLM-generated math question
- `GET /admin` serves the admin editor when authenticated, otherwise redirects to `/admin/login.html`
- `GET /admin/login.html` serves the admin login page
- `POST /api/admin/login` creates the admin session
- `POST /api/admin/logout` clears the admin session
- `GET /api/admin/chapters` lists editable chapters
- `POST /api/admin/chapters` creates a chapter
- `GET /api/admin/chapters/{chapter_id}/topics` lists editable topics
- `POST /api/admin/chapters/{chapter_id}/topics` creates a topic in a chapter
- `GET /api/admin/chapters/{chapter_id}/topics/{topic_id}/questions` lists questions
- `POST /api/admin/chapters/{chapter_id}/topics/{topic_id}/questions` creates a question
- `PUT /api/admin/chapters/{chapter_id}/topics/{topic_id}/questions/{question_id}` updates a question
- `DELETE /api/admin/chapters/{chapter_id}/topics/{topic_id}/questions/{question_id}` deletes a question
- unknown quiz IDs return `404` with `Quiz not found`

Configuration:

- `APP_ENV`, default: `dev`
- `QUIZ_DATA_DIR`, default: `backend/app/data/chapters`
- `ADMIN_USERNAME`, required for admin login
- `ADMIN_PASSWORD_HASH`, required for admin login; plaintext passwords must not
  be stored in the repository

The current backend allows CORS from any origin.

Admin authentication is deliberately minimal. There is exactly one administrator.
The backend verifies the configured password hash and stores the authenticated
admin state in a signed HTTP-only session cookie. Admin write endpoints require
authentication.

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

### `OrderItem`

```json
{
  "id": "event-id",
  "text": "Event label",
  "position": 1
}
```

Fields:

- `id`: stable item identifier, unique within one question
- `text`: item label shown to the user
- `position`: correct 1-based position in the final sequence

### `MatchingPair`

```json
{
  "id": "pair-id",
  "left": "Left column label",
  "right": "Right column label"
}
```

Fields:

- `id`: stable pair identifier, unique within one question
- `left`: item label shown in the left column
- `right`: matching item label shown as a right-column choice; the same label may
  be reused by more than one pair for category-style matching

### `QuestionContext`

```json
{
  "text": "Context passage",
  "source": "Optional source"
}
```

Fields:

- `text`: plain source/context passage shown above the question; if the
  `context` object exists, `text` must be non-empty
- `source`: optional source attribution shown below the context text

### `AnswerSlot`

```json
{
  "accepted_answers": ["accepted value"]
}
```

Fields:

- `accepted_answers`: non-empty list of accepted answer variants for one input
  field in a multi-slot open question

### `Question`

```json
{
  "id": "unique-question-id",
  "text": "Question text",
  "source_text": null,
  "context": null,
  "image": null,
  "explanation": "Optional feedback explanation",
  "selection_type": "single",
  "answers": [],
  "accepted_answers": [],
  "answer_slots": [],
  "order_items": [],
  "matching_pairs": [],
  "topic_id": null
}
```

Fields:

- `id`: question identifier, unique within a chapter
- `text`: question text
- `source_text`: optional source passage shown above the question
- `context`: optional context passage with source attribution; preferred for new
  source/context questions
- `image`: `null`, a `/static/...` path, an `http://`/`https://` URL, or a list
  of those image references
- `explanation`: feedback text shown after an incorrect answer; optional for
  `single` and `multiple`, required for `open`, `llm`, `order`, and `matching`
- `selection_type`: `single`, `multiple`, `open`, `llm`, `order`, or `matching`
- `answers`: answer options for `single` and `multiple` questions
- `accepted_answers`: accepted values for one-field `open` questions and the
  reference answer for `llm` questions
- `answer_slots`: answer fields for multi-slot `open` questions
- `order_items`: sequence items for `order` questions
- `matching_pairs`: left/right pairs for `matching` questions
- `topic_id`: optional topic identifier set by admin writes so a created
  question can be traced to its topic without showing technical IDs in the UI

For `open` questions, the data model is intentionally unambiguous:

- `accepted_answers` present means a one-field open question
- `answer_slots` present means a multi-field open question
- an open question with neither is invalid
- an open question with both is invalid

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

Fields:

- `topic_id`: unique topic identifier inside a chapter
- `topic_title`: human-readable topic title
- `questions`: questions available for this topic; an existing topic may be
  temporarily empty after admin edits

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
  and may be empty immediately after a new admin-created chapter is added

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

- `frontend/index.html` - main subject menu
- `frontend/history.html` - history quiz list
- `frontend/math.html` - generated math question screen
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

- showing the main subject menu
- loading the quiz list
- filtering history and one-shot LLM quizzes on the history section page
- requesting a generated math question when the math page opens
- showing a localized LLM-unavailable message if the generated math question
  endpoint cannot be reached
- returning from a quiz to the section that launched it when the section is provided
  in the query string
- loading the selected quiz by query-string `id`
- displaying one question at a time
- displaying optional source text above a question
- displaying optional context text and source above a question
- randomizing answer order for closed questions
- handling answer selection
- checking answers in the browser
- tracking earned points and maximum points in page memory
- showing the final result screen
- restarting the current quiz by fetching it from the backend again

The frontend does not persist scores and does not send user answers to the backend.

## 10. Answer Rules and Scoring

Scores are point-based. Maximum points are derived from question structure:

- `single`: 1 point
- `multiple`: 1 point
- one-field `open`: 1 point
- multi-slot `open`: one point per `answer_slots` item
- `llm`, `order`, and `matching`: 1 point

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

- the user types one or more short answers
- the answer is checked after clicking the localized check button or pressing Enter
- an empty answer set shows a localized required-answer message
- one-field open questions are compared against `accepted_answers`
- multi-slot open questions render one input per `answer_slots` item
- multi-slot answers are matched greedily after normalization and do not depend
  on slot order
- one user answer can satisfy at most one slot
- each matched slot gives one point
- normalization includes:
  - trimming whitespace
  - replacing consecutive whitespace inside the answer with a single space
  - lowercasing
  - removing trailing punctuation and trailing non-letter/non-number characters
  - replacing Polish diacritics with their plain ASCII equivalents

`llm`:

- the user writes a full-sentence answer
- the answer is sent to the configured LLM evaluation service
- the first `accepted_answers` item is sent as the reference answer
- LLM points are used directly as the quiz score for the question, usually `0`, `0.5`, or `1`
- the UI shows the LLM feedback and returned point count

`order`:

- the user arranges items into the correct sequence
- items are checked after clicking the localized check button
- the result is correct only if every item is in the exact position declared by
  `order_items[].position`
- `order_items` must contain at least two items
- positions must be consecutive integers from `1` to the number of items
- answer order is randomized before display

`matching`:

- the user matches each left-column item to one right-column item
- items are checked after clicking the localized check button
- the result is correct only if every left-column item is paired with its matching
  right-column item
- `matching_pairs` must contain at least two pairs
- each pair must have a unique `id` and `left`
- `right` labels must be non-empty and may repeat when multiple left-column items
  share the same matching category
- left-column row order and unique right-column choices may be randomized before
  display

After a correct answer, the frontend shows a localized success message. After an
incorrect answer, it shows the question `explanation` when one is available.
For multi-slot open questions, feedback also shows earned points for that
question, for example `Zdobyte punkty: 1 / 2`.

## 11. Final Result

At the end of the quiz, the frontend shows:

- score as earned points over maximum points
- percentage
- school grade computed from the rounded percentage
- localized result message
- result icon
- localized restart button

The school grade is selected from the rounded percentage:

- `< 30%`: `1`
- `>= 30%` and `<= 50%`: `2`
- `>= 51%` and `<= 75%`: `3`
- `>= 76%` and `<= 89%`: `4`
- `>= 90%` and `<= 99%`: `5`
- `100%`: `6`

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
- a non-empty list of `/static/...`, `http://...`, or `https://...` image
  references

For local images, the frontend builds the URL by joining `CONFIG.API_BASE_URL` and
the image path. With the current Nginx setup, `/static/...` works relative to the
same host.

When a question defines a list of image references, the backend randomly selects
one image while assembling the quiz. The frontend still receives one concrete
image reference in the ready quiz payload.

The admin editor supports image questions only for `single` and `open` question
types. An administrator may provide either an internet image URL or choose a local
image file. Local admin uploads are copied into backend static files under
`/static/images/admin/...`, and the stored question keeps that `/static/...` path.
The admin editor sends local files as base64 JSON payloads so the project does
not need multipart form dependencies.

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
- `topics` must be a list, and each listed topic filename must be non-empty
- no duplicate topic files in `topics`
- existence of every topic file referenced by `meta.json`
- required `topic_id`, `topic_title`, and `questions` fields
- `questions` must be a list
- no duplicate `topic_id` values within a chapter
- no duplicate question IDs within a topic or chapter
- required non-empty `explanation` on `open`, `llm`, `order`, and `matching`
  questions; optional `explanation` on `single` and `multiple` questions
- valid `selection_type`
- optional `source_text` structure
- optional `context` structure
- answer structure for `single` and `multiple`
- exactly one correct answer for `single`
- at least two correct answers for `multiple`
- non-empty `accepted_answers` or non-empty `answer_slots` for `open`
- rejection of `open` questions that contain both `accepted_answers` and
  `answer_slots`
- valid `order_items` for `order`
- valid `matching_pairs` for `matching`
- local image path format and file existence, including every item in image lists

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
- `open`, `llm`, `order`, and `matching` questions must include a non-empty
  `explanation`; `single` and `multiple` questions may omit it
- do not change the JSON schema without updating this specification, the backend
  models, and the validator
- source-based questions may add `source_text` while keeping the regular
  `selection_type` flow
- new source/context questions should prefer `context` with optional `source`
- order questions use `order_items` with stable item IDs and consecutive
  1-based positions
- matching questions use `matching_pairs` with stable pair IDs and unique left
  labels; right labels may repeat for category-style matching
- quiz content should be written for a child aged 10-12
- quiz content should be in Polish
- open questions should include all required variants in `accepted_answers`
- multi-slot open questions should include all required variants in each
  `answer_slots[].accepted_answers`
- closed questions should usually have four answers, but the model only requires
  a valid answer list and the correct number of correct answers
- prefer ASCII-safe `topic_id`, filenames, and question IDs

The current repository contains these chapter directories:

- `backend/app/data/chapters/history-chapter-6`
- `backend/app/data/chapters/history-konfederacja-upadek-rzeczypospolitej`
- `backend/app/data/chapters/history-napoleon-rewolucja-francuska`

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
- optional structured context block with source attribution
- question text
- optional image
- answers, text input, sequence controls, or matching controls
- feedback
- localized primary action button

Enter works globally on the quiz screen:

- if the next action is visible, Enter advances to the next question
- if the check action is visible, Enter checks the answer

The admin interface is intentionally plain and functional:

- it uses vanilla HTML/CSS/JavaScript
- it starts with a chapter list, then a topic list, then questions for one topic
- it supports creating chapters by entering only a chapter name
- it supports creating topics inside the currently selected chapter by entering
  only a topic name
- it lists questions without exposing filenames, JSON structure, question IDs, or
  selection internals
- its question editor shows only the answer fields relevant to the selected
  question type
- it supports creating, editing, and deleting `single`, `multiple`, one-field
  `open`, multi-slot `open`, `llm`, `order`, and `matching` questions
- it supports image fields only for `single` and `open` questions
- it lets the administrator enter source/context text without requiring a
  separate source attribution field
- it only shows the question editor after the administrator selects a chapter
  and a topic

JSON files remain the source of truth. Admin writes load the existing topic JSON,
modify it in memory, validate the chapter with the shared validation rules, write
to a temporary file, keep one `.bak` backup of the previous topic file, and then
atomically replace the topic file.
Admin-created chapters write a new chapter directory and `meta.json`. Admin-created
topics write an empty topic JSON file and append that filename to the chapter
metadata.

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

The first production version is a working single-player quiz application that
runs through Docker Compose, shows a quiz list, loads a selected quiz from the
backend, supports `single`, `multiple`, `open`, `order`, and `matching`
questions, handles images and context text, shows immediate feedback and a
point-based final result, keeps quiz content in validated chapter and topic JSON
files, and includes a minimal authenticated admin panel for editing questions in
chapter topics.

