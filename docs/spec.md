# Edu Quiz for Kids - Project Specification

## 1. Product Goal

Edu Quiz for Kids is a lightweight educational quiz application for home learning,
designed for a child aged about 10-12. The first production version supports
single-player school revision for history, geography, biology, and math, plus a
minimal single-admin authoring panel for editing JSON-backed questions.

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

- subject menu and subject-specific quiz list pages
- one quiz represents one school book chapter
- history, geography, biology, and math use the same chapter/topic/question learning
  method
- each playable chapter contains one or more topics; a newly created admin
  chapter may temporarily contain no topics
- each topic is stored in a separate JSON file
- backend assembles ready quiz payloads from chapter metadata and topic files
- frontend renders ready quiz data returned by the backend
- question types: `single`, `multiple`, `true_false`, `open`, `llm`, `order`, `matching`, `map`, `hotspot`, `century`, `fill`, `written_multiplication`, `written_division`, `timed_multiplication`, `timed_division`, and `operation_order`
- optional source text passages on questions
- optional structured context passages with source attribution on questions
- optional images on questions, including multiple alternative images for one
  question
- image questions authored from an internet image URL or a local admin-uploaded
  image file
- the admin image library opens in the current chapter's most commonly used
  static-image folder; a local file is uploaded immediately to that folder and
  becomes a reusable library asset before the question itself is saved
- multi-slot open questions; the admin editor shows each answer slot as a card
  with separate, repeatable accepted-variant fields instead of delimiter-based input
- point-based scoring derived from question structure
- minimal admin login with a signed session cookie
- admin question editor for existing chapters and topics, scoped per subject
- creating new chapters and topics from the admin panel
- creating a topic uses an in-app modal with validation instead of a browser-native prompt
- deleting a topic uses an in-app confirmation and removes it from chapter metadata;
  the topic JSON and its backup are moved to a chapter-local recovery archive
- creating, editing, and deleting questions in existing topic JSON files
- moving questions between existing topics in the same chapter
- the admin fill-question editor uses separate option rows, explicit correct-answer
  controls, and live validation that each blank marker appears exactly once
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
- retrying incorrect questions after the quiz
- advanced gamification

## 4. Architecture

The project consists of:

- FastAPI backend in `backend/app`
- React/TypeScript frontend in `frontend`
- quiz content JSON files in `backend/app/data/chapters`
- static files, including local images, in `backend/app/static`
- Nginx configuration in `nginx/default.conf`
- Docker Compose workflow in `docker-compose.yml`

Docker Compose builds the backend and the React frontend image. The React image
uses a multi-stage build: Vite produces static files and the runtime stage uses
only `nginx:stable-alpine`. Nginx serves the React application and proxies API,
health, LLM, and static-asset requests to the existing services.

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
- `/admin` and `/admin/login.html` - React admin application; the page checks
  the existing admin session through `/api/admin/me`

The frontend uses `CONFIG.API_BASE_URL`. The current default value is an empty
string, so API requests are relative and go through Nginx.

## 6. Backend

The backend exposes a small API and assembles quizzes from JSON files.

Endpoints:

- `GET /health` returns `{ "status": "ok" }`
- `GET /api/quizzes` returns lightweight quiz metadata without questions
- `GET /api/quizzes/{quiz_id}` returns a full quiz payload with questions; the
  optional `difficulty=easy|medium|pro` query parameter defaults to `easy`;
  legacy `hard` is treated as `pro`
- `GET /api/math/question` returns a placeholder LLM-generated math question
- the production Nginx frontend serves the React admin application at `/admin`
  and `/admin/login.html`; an unauthenticated visitor sees its login screen
- `POST /api/admin/login` creates the admin session
- `POST /api/admin/logout` clears the admin session
- after logging out, the admin application redirects the user to the main page
- `GET /api/admin/subjects` lists editable JSON-backed subjects
- `GET /api/admin/chapters` lists editable chapters
- `GET /api/admin/chapters?subject={subject}` lists editable chapters for one subject
- `POST /api/admin/chapters` creates a chapter
- `PUT /api/admin/chapters/{chapter_id}/chapter-number` sets or clears the optional
  chapter badge number
- `PUT /api/admin/chapters/{chapter_id}/target-question-count` sets the number of
  questions randomly selected for the chapter quiz
- `GET /api/admin/chapters/{chapter_id}/topics` lists editable topics
- `GET /api/admin/chapters/{chapter_id}/images` lists reusable subject images and
  identifies the folder most commonly referenced by the current chapter
- `POST /api/admin/chapters/{chapter_id}/images` uploads a local image immediately
  to the chapter's default reusable image folder
- `POST /api/admin/chapters/{chapter_id}/topics` creates a topic in a chapter
- `DELETE /api/admin/chapters/{chapter_id}/topics/{topic_id}` removes a topic from
  the chapter and archives its topic file for recovery
- `PUT /api/admin/chapters/{chapter_id}/topics/{topic_id}/active` activates or
  deactivates a topic without deleting its prepared questions
- `GET /api/admin/chapters/{chapter_id}/topics/{topic_id}/questions` lists questions
- `POST /api/admin/chapters/{chapter_id}/topics/{topic_id}/questions` creates a question
- `PUT /api/admin/chapters/{chapter_id}/topics/{topic_id}/questions/{question_id}` updates a question
- `PUT /api/admin/chapters/{chapter_id}/topics/{topic_id}/questions/{question_id}/active`
  activates or deactivates a question without deleting it
- `POST /api/admin/chapters/{chapter_id}/topics/{topic_id}/questions/{question_id}/move`
  moves a question to another existing topic in the same chapter
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
- `left`: item label shown in the left column; the same label may be reused by
  more than one pair, for example when one category has multiple matching people
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

### `CenturyConfig`

```json
{
  "min_year": -1000,
  "max_year": 2000
}
```

Fields:

- `min_year`: inclusive lower year limit; negative values represent years p.n.e.
- `max_year`: inclusive upper year limit; positive values represent years n.e.
- year `0` is never generated because it does not belong to either era
- generated century questions require both the Roman century number and its
  chronological half; both answers must be correct to earn the point
- for CE years, years `01-50` form the first half and `51-00` the second half
- for BCE years the count is reversed: for example, `500-451 BCE` is the first
  half of the fifth century, while `450-401 BCE` is the second half

### `FillBlank`

```json
{
  "id": "direction",
  "accepted_answers": ["zachód"],
  "options": ["zachód", "wschód", "północ", "południe"]
}
```

- `id`: lowercase identifier referenced exactly once in `text` as `{{id}}`
- `accepted_answers`: non-empty list of accepted answer variants for this gap
- `options`: choices for this gap in `select` mode; empty in `open` mode

### `MapConfig`

```json
{
  "source": "/static/maps/poland-voivodeships.geojson",
  "background_source": "/static/maps/ancient-civilizations-basemap.geojson",
  "mode": "select",
  "target_feature_id": "mazowieckie",
  "interaction": "region"
}
```

Fields:

- `source`: local `/static/...` GeoJSON FeatureCollection used by the map renderer
- `background_source`: optional local `/static/...` GeoJSON FeatureCollection rendered below clickable regions
- `mode`: `select` when the learner clicks a region, or `identify` when the
  learner identifies a highlighted region using standard answer buttons
- `target_feature_id`: stable technical identifier matching `feature.id` or
  `feature.properties.id`
- `interaction`: optional target shape for `select` mode; `region` is the
  default, `line` lets the learner click the nearest answer line within a
  generous pointer tolerance

### `HotspotConfig`

```json
{
  "source": "/static/images/geography/compass-rose.svg",
  "target_hotspot_id": "N"
}
```

Fields:

- `source`: local `/static/...` SVG asset used by the hotspot renderer
- `target_hotspot_id`: stable technical identifier matching a unique
  `data-hotspot-id` attribute in the SVG

### `WrittenMultiplicationConfig`

```json
{
  "min_factor": 10,
  "max_factor": 9999,
  "max_total_digits": 6,
  "easy_max_total_digits": 4,
  "easy_max_partial_product": 100
}
```

Fields:

- `min_factor`: inclusive lower limit for both generated integer factors
- `max_factor`: inclusive upper limit for both generated integer factors
- both limits must stay in the supported `10` to `9999` range
- `max_total_digits`: maximum combined digit count of both generated factors;
  must be between `4` and `6`
- `easy_max_total_digits`: combined digit limit used in easy mode
- `easy_max_partial_product`: largest partial product allowed in easy mode

### `WrittenDivisionConfig`

```json
{
  "min_divisor": 2,
  "max_divisor": 99,
  "min_quotient": 10,
  "max_quotient": 9999,
  "max_dividend_digits": 6,
  "easy_min_divisor": 3,
  "easy_max_divisor": 10,
  "medium_min_divisor": 8,
  "medium_max_divisor": 15,
  "easy_max_quotient": 999,
  "easy_max_dividend_digits": 4,
  "easy_max_intermediate_value": 100
}
```

Fields:

- `min_divisor` and `max_divisor`: inclusive range for the generated divisor
- `min_quotient` and `max_quotient`: inclusive range for the generated integer quotient
- `max_dividend_digits`: maximum digit count of the generated dividend, up to `6`
- `easy_min_divisor` and `easy_max_divisor`: inclusive divisor range in easy
  mode; the defaults are `3` and `10`
- `medium_min_divisor` and `medium_max_divisor`: inclusive divisor range in
  medium mode; the defaults are `8` and `15`
- `easy_max_quotient`: inclusive quotient limit in easy mode
- `easy_max_dividend_digits`: dividend digit limit in easy mode
- `easy_max_intermediate_value`: maximum partial dividend, subtraction, or
  remainder displayed in any easy-mode calculation step
- the backend calculates `dividend = divisor * quotient`, so every generated
  question has an integer result and final remainder zero

### `TimedMultiplicationConfig`

```json
{
  "min_factor": 3,
  "max_factor": 9,
  "time_limit_seconds": 5
}
```

Fields:

- `min_factor` and `max_factor`: inclusive range for both generated factors;
  the supported range is `3` to `9`, so factors `1`, `2`, and `10` are excluded
- `time_limit_seconds`: time available for answering one operation, from `1`
  to `60` seconds

### `TimedDivisionConfig`

```json
{
  "min_divisor": 3,
  "max_divisor": 9,
  "min_quotient": 3,
  "max_quotient": 9,
  "time_limit_seconds": 10
}
```

Fields:

- `min_divisor` and `max_divisor`: inclusive divisor range from `3` to `9`
- `min_quotient` and `max_quotient`: inclusive integer-result range from `3` to `9`
- `time_limit_seconds`: time available for answering one operation, default `10`
- the backend calculates `dividend = divisor * quotient`, so every question has
  an integer result and no remainder

### `OperationOrderConfig`

```json
{
  "family": "precedence"
}
```

Fields:

- `family`: one of `precedence`, `parentheses`, `powers`, or `left_to_right`
- the backend generates an integer expression and its canonical reduction steps
  from this family for the selected `easy`, `medium`, or `pro` difficulty
- generated division always has an integer result, and generated intermediate
  values are non-negative and bounded for the selected difficulty
- every generated expression combines operations from at least two precedence
  levels; exercises made only from addition/subtraction or only from
  multiplication/division are not generated
- no initial or intermediate expression may contain adjacent inverse operations
  that cancel the same factor, such as `9 × 9 : 9`, `5 × 8 : 8`, or
  `24 : 6 × 6`
- squares use a base no greater than `10`, including bases produced by a
  parenthesized intermediate operation; the additional supported powers are
  exactly `2³`, `2⁴`, and `3³` (`3²` is already included among squares)
- the frontend keeps the initial expression visible and appends every canonical
  reduction underneath it, including the final result, so the learner can review
  the complete calculation path
- on easy and medium, an incorrect operation or intermediate result displays a
  hint and lets the learner retry; completing every reduction correctly awards
  the question point even when an earlier attempt was incorrect
- on pro, the first incorrect operation or intermediate result ends the question
  with zero points, displays an error, a rule or calculation hint, and the correct
  solution path, then lets the learner continue to the next question
- every pro expression contains at least one explicit pair of parentheses and a
  simple leading term before the grouped expression, so the first correct
  operation is not systematically placed at the far-left edge
- operation choices identify the operator by showing only its local visible
  fragment, for example `dodawanie: 10 + 10`, rather than repeating the complete
  expression inside the button
- the expression history and operation choices keep visible inner spacing from
  their containers; long expressions use compact typography and may wrap inside
  the calculation field instead of being clipped or hidden behind horizontal
  scrolling

### `Question`

```json
{
  "id": "unique-question-id",
  "is_active": true,
  "text": "Question text",
  "source_text": null,
  "context": null,
  "image": null,
  "explanation": "Optional feedback explanation",
  "selection_type": "single",
  "answers": [],
  "accepted_answers": [],
  "answer_slots": [],
  "fill_mode": null,
  "fill_blanks": [],
  "century_config": null,
  "century_year": null,
  "correct_century": null,
  "correct_century_half": null,
  "operation_order_config": null,
  "operation_order_difficulty": null,
  "operation_order_expression": null,
  "operation_order_steps": [],
  "operation_order_result": null,
  "written_multiplication_config": null,
  "multiplicand": null,
  "multiplier": null,
  "written_division_config": null,
  "timed_multiplication_config": null,
  "timed_division_config": null,
  "dividend": null,
  "divisor": null,
  "quotient": null,
  "order_items": [],
  "matching_pairs": [],
  "map_config": null,
  "hotspot_config": null,
  "topic_id": null
}
```

Fields:

- `id`: question identifier, unique within a chapter
- `is_active`: whether the question participates in quiz assembly; defaults to
  `true` for backward compatibility when omitted
- `text`: question text
- `source_text`: optional source passage shown above the question
- `context`: optional context passage with source attribution; preferred for new
  source/context questions
- `image`: `null`, a `/static/...` path, an `http://`/`https://` URL, or a list
  of those image references
- `explanation`: feedback text shown after an incorrect answer; optional for
  `single` and `multiple`, required for `true_false`, `open`, `llm`, `order`, `matching`,
  `hotspot`, `century`, `fill`, `written_multiplication`, `written_division`,
  `timed_multiplication`, `timed_division`, and `operation_order`
- `selection_type`: `single`, `multiple`, `true_false`, `open`, `llm`, `order`, `matching`,
  `map`, `hotspot`, `century`, `fill`, `written_multiplication`, `written_division`,
  `timed_multiplication`, `timed_division`, or `operation_order`
- `answers`: answer options for `single` and `multiple` questions, or statements
  for `true_false` questions where `is_correct` means the statement is true
- `accepted_answers`: accepted values for one-field `open` questions and the
  reference answer for `llm` questions
- `answer_slots`: answer fields for multi-slot `open` questions
- `fill_mode`: `select` or `open` interaction for `fill` questions
- `fill_blanks`: named gaps for `fill` questions, referenced in `text` using
  `{{id}}`
- `century_config`: source range for a generated `century` question
- `century_year`: generated signed year returned in a quiz payload; negative is p.n.e.
- `correct_century`: generated correct century number returned in a quiz payload
- `correct_century_half`: generated chronological half, `first` or `second`
- `operation_order_config`: concept family used by an authored generated template
- `operation_order_difficulty`: selected difficulty returned in the ready payload
- `operation_order_expression`: generated expression rendered with school symbols
- `operation_order_steps`: ordered reductions, selectable operation choices,
  expected intermediate values, and localized rule hints
- `operation_order_result`: final integer result
- `written_multiplication_config`: factor range for a generated written multiplication
- `multiplicand`: concrete generated upper factor returned in a quiz payload
- `multiplier`: concrete generated lower factor returned in a quiz payload
- `written_division_config`: ranges used to generate exact written division
- `timed_multiplication_config`: factor range and per-question time limit for
  multiplication-table practice
- `timed_division_config`: divisor, integer-result range, and per-question time
  limit for division-table practice
- `dividend`: generated dividend returned in a quiz payload
- `divisor`: generated divisor returned in a quiz payload
- `quotient`: generated integer quotient returned in a quiz payload
- `order_items`: sequence items for `order` questions
- `matching_pairs`: left/right pairs for `matching` questions
- `map_config`: map asset and target configuration for `map` questions
- `hotspot_config`: SVG asset and target region configuration for `hotspot`
  questions
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
  "is_active": true,
  "questions": []
}
```

Fields:

- `topic_id`: unique topic identifier inside a chapter
- `topic_title`: human-readable topic title
- `is_active`: whether the topic participates in quiz assembly; defaults to
  `true` for backward compatibility when omitted
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
  "chapter_number": 6,
  "difficulty_levels": ["easy", "medium", "pro"],
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
- `category`: subject/category identifier; JSON-backed school subjects are
  `history`, `geography`, `biology`, and `math`
- `age_group`: intended age group
- `chapter_number`: optional positive integer displayed as the `Rozdział X` badge on
  the quiz card; omit it or set it to `null` to hide the badge
- `difficulty_levels`: optional ordered list containing `easy`, `medium`, and/or
  `pro`; when non-empty, the quiz card renders a level selector and sends the
  chosen value to the quiz endpoint
- `target_question_count`: target number of questions in the final quiz, default `12`
- `questions_per_topic`: legacy field used by the model and validator, default `2`;
  the current loader does not use it when assembling quizzes
- `topics`: topic JSON files in the order used by the backend for base selection
  and may be empty immediately after a new admin-created chapter is added

## 8. Quiz Assembly

Quiz assembly logic lives in `backend/app/services/quiz_loader.py`.

For each chapter, the backend:

1. Loads `meta.json`.
2. Reads topic filenames from `topics` and loads only topics whose `is_active`
   value is `true` or omitted.
3. Returns an empty-question quiz if there are no active topics.
4. Computes the base per-topic quota:

   ```python
   questions_per_topic = max(1, target_question_count // topic_count)
   ```

5. For each active topic, in `meta.json` order:
   - loads the topic file
   - removes questions whose `is_active` value is `false`, then shuffles the
     remaining questions
   - takes the base quota from the shuffled topic list
   - keeps remaining topic questions as fallback questions for that topic
6. If fewer than `target_question_count` questions were selected, the backend
   fills the missing slots from per-topic fallback questions while preserving
   the `meta.json` topic order.
7. The backend resolves generated templates, including concrete century years,
   unique written-multiplication factor pairs, exact written-division pairs,
   unique commutative multiplication-table pairs, and unique order-of-operations
   expressions with canonical reduction steps for the current attempt.
   Written calculations use easy mode by default. Easy multiplication limits
   partial products, while easy division limits the divisor to `12` and every
   displayed intermediate value to `100`. Hard mode uses the regular configured
   ranges.
8. The backend returns the final selected question list grouped by the topic
   order from `meta.json` and returns the assembled quiz.

If the available question pool is smaller than `target_question_count`, the quiz
will be shorter. If `target_question_count` is lower than the number of topics,
the current `max(1, ...)` rule can select more questions than the target because
the final list is not trimmed after the base selection step.

## 9. Frontend

The frontend is a React/TypeScript application in `frontend` and consists
of a Vite entry point, typed API clients, subject and quiz components, and a
separate React admin screen selected by the `/admin` URL. `public/js/config.js`
keeps `API_BASE_URL` configurable at container startup rather than fixing it at
build time.

The application is designed for desktop use. New frontend features do not need
mobile or touch support unless explicitly requested.

The frontend is responsible for:

- showing the main subject menu
- loading the quiz list
- filtering history, geography, biology, and math quiz lists by chapter category
- keeping one-shot LLM quizzes on the history section page
- rendering generated written-multiplication questions with carry scratch fields,
  partial-product rows, place-value offsets, and a final result row
- rendering exact written-division questions in the Polish school layout, with
  the quotient entered above a rule drawn over the dividend, no scratch fields,
  aligned subtraction steps, brought-down partial dividends, and a final zero remainder
- showing the difficulty levels declared by chapter metadata; `Łatwy` is selected
  by default, changing the level starts a new attempt, and restarting preserves
  the selected level
- rendering order-of-operations questions step by step; easy mode highlights the
  next subexpression and explains the rule, while medium and pro modes require
  the learner to select the next operation before entering its result
- rendering multiplication-table questions with a visible per-question countdown;
  expiry records an incorrect answer, shows the correct result, and waits for the
  learner to continue
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
- playing a short celebration sound and confetti animation when the learner earns 100% of the available points
- starting every refreshed or restarted quiz attempt by fetching a newly
  assembled question set from the backend

The frontend does not persist scores and does not send user answers to the backend.
The admin screen uses the existing `/api/admin/*` endpoints and their signed
HTTP-only session cookie; it does not move content validation or writes into the
browser.

## 10. Answer Rules and Scoring

Scores are point-based. Maximum points are derived from question structure:

- `single`: 1 point
- `multiple`: 1 point
- `true_false`: 1 point
- one-field `open`: 1 point
- multi-slot `open`: one point when every answer slot is correct
- `llm`, `order`, `matching`, `map`, `hotspot`, `century`, `fill`,
  `written_multiplication`, `written_division`, `timed_multiplication`, and
  `timed_division`, and `operation_order`: 1 point

`operation_order`:

- the backend returns a generated expression and its canonical reduction steps
- easy mode highlights the next subexpression and displays the applicable rule
- medium and pro modes first require the learner to select the next operation
- every step then requires the integer result of the highlighted subexpression
- on easy and medium, an incorrect choice or intermediate result shows a hint
  and allows a retry; the question earns one point after every step is completed
  correctly
- on pro, the first incorrect choice or intermediate result immediately records
  zero points, shows an error with a hint and the correct solution path, and
  enables navigation to the next question
- on pro, the question earns one point only when every step is correct on the
  first try

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

`true_false`:

- the learner evaluates every displayed statement as `P` (true) or `F` (false)
- the answer is checked after clicking the localized check button
- the learner earns 1 point only when every statement is evaluated correctly
- `answers` must contain at least two statements, including at least one true
  and one false statement

`open`:

- the user types one or more short answers
- the answer is checked after clicking the localized check button or pressing Enter
- an empty answer set shows a localized required-answer message
- one-field open questions are compared against `accepted_answers`
- multi-slot open questions render one input per `answer_slots` item
- multi-slot answers are matched greedily after normalization and do not depend
  on slot order
- one user answer can satisfy at most one slot
- every answer slot must be matched for the answer to earn one point; a partial answer earns zero points
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

`century`:

- the backend generates a non-zero year from `century_config` when it assembles a quiz
- the learner sees whether the generated year is p.n.e. or n.e. and types the
  century number using Roman numerals
- the correct century uses the same boundary rule in both eras: years 1-100 are
  century I, 101-200 are century II, and so on
- the feedback states the generated year, its Roman-numeral century, and its era

`fill`:

- question text contains one or more named blank tokens, for example
  `Ameryka Północna leży na {{direction}} od Europy.`
- in `select` mode every blank is a choice list; accepted values must appear in
  that blank's `options`
- in `open` mode every blank is a text field and uses the same normalization as
  `open` questions
- every gap must be filled and correct in its declared position to earn 1 point;
  a partial answer earns 0 points

`order`:

- the user arranges items into the correct sequence
- items can be moved onto a concrete numbered position by drag and drop or with
  visible up/down buttons; the target position is highlighted before dropping
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

`map`:

- `map_config` is required
- `map_config.source` points to a local GeoJSON asset under `/static/...`
- the GeoJSON contains one Feature per selectable/highlightable region
- each Feature uses `id` or `properties.id` as the stable technical identifier
  and may use `properties.name` or `properties.name_pl` as a visible/source label
- `select` mode lets the user answer by clicking one SVG-rendered region
- `select` mode may use `interaction: "line"` when the source GeoJSON contains
  answer LineString or MultiLineString features; in that case the user answers
  by clicking near a line. The frontend uses a generous pointer tolerance and,
  near crossings, prioritizes the requested line when it is the nearest line of
  the same kind (for example, a parallel rather than a crossing meridian)
- a correct `select` click gives 1 point; an incorrect click gives 0 points
- after a `select` answer, the chosen incorrect region and the correct target
  region are visually marked and map interaction is locked
- `identify` mode highlights the target region and reuses standard single-choice
  answer buttons and scoring
- the frontend renders Polygon and MultiPolygon GeoJSON directly to SVG and keeps
  a minimal in-memory GeoJSON cache by source path

`hotspot`:

- `hotspot_config` is required
- `hotspot_config.source` points to a local SVG asset under `/static/...`
- each clickable region has a unique, non-empty `data-hotspot-id`
- `target_hotspot_id` must match one clickable region exactly
- the SVG must not contain scripts, embedded HTML, style elements, inline event
  handlers, inline styles, or external references
- the user answers immediately by clicking a region or selecting it with the
  keyboard
- a correct click gives 1 point; an incorrect click gives 0 points
- after answering, the correct region and any chosen incorrect region are marked,
  their labels are revealed, and further interaction is locked
- the frontend keeps a minimal in-memory SVG cache by source path

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
image file. Selecting a local file immediately copies it to the current chapter's
default reusable folder below `/static/images/...`; the editor stores the returned
path in the draft. The admin editor sends local files as base64 JSON payloads so
the project does not need multipart form dependencies.

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
- optional unique `difficulty_levels` containing only `easy`, `medium`, and `pro`
- `topics` must be a list, and each listed topic filename must be non-empty
- no duplicate topic files in `topics`
- existence of every topic file referenced by `meta.json`
- required `topic_id`, `topic_title`, and `questions` fields
- `questions` must be a list
- no duplicate `topic_id` values within a chapter
- no duplicate question IDs within a topic or chapter
- required non-empty `explanation` on `true_false`, `open`, `llm`, `order`, `matching`,
  `hotspot`, `century`, `fill`, `written_multiplication`, `written_division`, and
  `timed_multiplication`, `timed_division`, and `operation_order` questions; optional `explanation` on `single` and
  `multiple` questions
- valid `selection_type`
- optional `source_text` structure
- optional `context` structure
- answer structure for `single`, `multiple`, and `true_false`
- exactly one correct answer for `single`
- at least two correct answers for `multiple`
- at least two statements, including one true and one false statement, for
  `true_false`
- non-empty `accepted_answers` or non-empty `answer_slots` for `open`
- rejection of `open` questions that contain both `accepted_answers` and
  `answer_slots`
- valid `order_items` for `order`
- valid `matching_pairs` for `matching`
- valid `century_config` for `century`
- valid `fill_mode`, `fill_blanks`, and one matching `{{id}}` token per blank
  for `fill`
- valid factor limits from `10` to `9999` and a satisfiable combined limit of
  at most six factor digits for `written_multiplication`
- valid divisor and quotient ranges that can produce an exact division with a
  dividend of at most six digits for `written_division`
- valid factor limits from `3` to `9` and a time limit from `1` to `60`
  seconds for `timed_multiplication`
- valid divisor and quotient limits from `3` to `9` and a time limit from `1`
  to `60` seconds for `timed_division`
- valid concept family for `operation_order`
- valid local SVG source, unique SVG hotspot IDs, and existing target for `hotspot`
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
- `true_false`, `open`, `llm`, `order`, `matching`, `hotspot`, `century`, `fill`, `written_multiplication`, `written_division`, `timed_multiplication`, `timed_division`, and `operation_order` questions must include a
  non-empty `explanation`; `single` and `multiple` questions may omit it
- do not change the JSON schema without updating this specification, the backend
  models, and the validator
- source-based questions may add `source_text` while keeping the regular
  `selection_type` flow
- new source/context questions should prefer `context` with optional `source`
- order questions use `order_items` with stable item IDs and consecutive
  1-based positions
- matching questions use `matching_pairs` with stable pair IDs and unique left
  labels; right labels may repeat for category-style matching
- century questions use `century_config`; a generated year must never be zero
- fill questions use `fill_mode` and `fill_blanks`; include every `{{id}}` once
  in the question text and provide at least two options for `select` blanks
- written multiplication questions use `written_multiplication_config`; the
  backend generates fresh factors for every quiz attempt, and the combined
  number of factor digits never exceeds `max_total_digits`; easy mode also
  enforces `easy_max_total_digits` and `easy_max_partial_product`
- written division questions use `written_division_config`; the backend generates
  the dividend from a divisor and an integer quotient, so the final remainder is
  zero; easy mode uses `easy_min_divisor` through `easy_max_divisor`, medium mode
  uses `medium_min_divisor` through `medium_max_divisor`, and both validate every
  displayed calculation step against `easy_max_intermediate_value`; pro mode uses
  the full base ranges; the level selector is shown on the quiz card before the
  attempt begins; when an intermediate subtraction equals zero, the written-work
  layout requires the learner to enter that zero before continuing to the next step
- timed multiplication questions use `timed_multiplication_config`; the backend
  generates fresh factors for every attempt, treats reversed factors as the same
  pair, and generates factors only from `3` to `9`
- timed division questions use `timed_division_config`; the backend generates a
  divisor and integer quotient from `3` to `9`, derives the dividend from their
  product, and gives the learner `10` seconds by default
- order-of-operations questions use `operation_order_config`; math-specific tree
  generation and reduction live in `backend/app/services/math/operation_order.py`,
  while `quiz_loader.py` only invokes the resolver during quiz assembly
- hotspot questions use a validated local SVG with stable `data-hotspot-id`
  attributes and a matching `hotspot_config.target_hotspot_id`
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
- `backend/app/data/chapters/geography-maps-mvp`
- `backend/app/data/chapters/geography-continents-maps`
- `backend/app/data/chapters/math-order-of-operations`

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
- a reset control in the upper-right corner that restarts the current quiz

Enter works globally on the quiz screen:

- if the next action is visible, Enter advances to the next question
- if the check action is visible, Enter checks the answer

The admin interface is intentionally plain and functional:

- it uses React/TypeScript while preserving the existing admin API contract
- it starts with a subject selector for history, geography, biology, and math
- it starts with a chapter list, then a topic list, then questions for one topic
- it supports creating chapters inside the currently selected subject by
  entering only a chapter name
- it supports creating topics inside the currently selected chapter by entering
  only a topic name; new topics start inactive so their content can be prepared
  before publication
- it shows each topic's activation state and lets the administrator activate or
  deactivate it without removing questions
- it shows each question's activation state and lets the administrator activate
  or deactivate it without deleting the prepared content
- it lets the administrator set the number of questions randomly selected for a
  chapter quiz
- it lists questions without exposing filenames, JSON structure, question IDs, or
  selection internals
- its question editor shows only the answer fields relevant to the selected
  question type
- it supports creating, editing, and deleting `single`, `multiple`, `true_false`, one-field
  `open`, multi-slot `open`, `llm`, `order`, `matching`, `map`, `hotspot`, and
  `fill`, `timed_multiplication`, `timed_division`, `written_multiplication`,
  `written_division`, and `operation_order`
  questions
- it shows `timed_multiplication`, `timed_division`, `written_multiplication`,
  `written_division`, and `operation_order` only while editing a math chapter;
  backend validation also
  rejects these types in other subjects
- it supports image fields only for `single` and `open` questions
- it lets the administrator enter source/context text without requiring a
  separate source attribution field
- it only shows the question editor after the administrator selects a chapter
  and a topic

JSON files remain the source of truth. Admin writes load the existing topic JSON,
modify it in memory, validate the chapter with the shared validation rules, write
to a temporary file, keep one `.bak` backup of the previous topic file, and then
atomically replace the topic file.
Admin-created chapters write a new chapter directory and `meta.json` with
`category` set to the selected subject. Admin-created topics write an empty
topic JSON file and append that filename to the chapter metadata.

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

- more subject categories
- more chapters
- category-based quiz organization
- persisted results
- child profiles
- parent or teacher dashboard
- question editor
- image upload
- incorrect-answer retry mode
- database-backed content
- image attribution support for Wikimedia/Wikipedia images
- stricter production CORS settings
- encoding cleanup if Polish text display problems appear in content files

## 18. First Production Definition

The first production version is a working single-player quiz application that
runs through Docker Compose, shows a quiz list, loads a selected quiz from the
backend, supports `single`, `multiple`, `true_false`, `open`, `llm`, `order`, `matching`, `map`,
`hotspot`, `century`, `fill`, `written_multiplication`, `written_division`, and
`timed_multiplication`, `timed_division`, and `operation_order` questions, handles images and context text, shows immediate feedback and a
point-based final result, keeps quiz content in validated chapter and topic JSON
files, and includes a minimal authenticated admin panel for editing questions in
chapter topics.

