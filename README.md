# Edu Quiz for Kids

Edu Quiz for Kids is a lightweight single-player quiz application for home
learning. It is designed for a child aged about 10-12 and currently focuses on
school revision quizzes in Polish.

The project is intentionally small: it does not include login, user profiles,
rankings, a database, or an admin panel. Quiz content is stored in JSON files, and
the backend assembles ready quiz payloads for the frontend.

## Purpose

The goal of this repository is to provide a simple educational quiz service that:

- helps a child revise school material before tests
- runs on a home server, including Raspberry Pi 3
- is easy to maintain and extend with new chapters
- keeps quiz content separate from application logic
- stays independent from other home-server applications

## How It Works

The application has two main screens:

- a quiz list page
- a quiz page that shows one question at a time

Each quiz represents one school book chapter. A chapter contains topic JSON files,
and each topic contains questions. The backend loads the chapter metadata, selects
questions from the topic files, shuffles the final question set, and returns it to
the frontend.

Supported question types:

- `single` - one correct answer
- `multiple` - multiple correct answers
- `open` - short free-text answer checked against accepted variants

The frontend handles answer selection, immediate feedback, progress display, final
score, and quiz restart. Scores are not persisted.

## Stack

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: FastAPI
- Data: JSON files
- Static serving and reverse proxy: Nginx
- Runtime workflow: Docker Compose

## Repository Structure

```text
backend/
  app/
    api/                 FastAPI routes
    data/chapters/       quiz chapter and topic JSON files
    models/              Pydantic models
    services/            quiz loading and assembly logic
    static/              local static assets, including images
  scripts/               quiz validation scripts
frontend/
  css/                   frontend styles
  js/                    frontend JavaScript modules
  index.html             quiz list page
  quiz.html              quiz player page
docs/
  spec.md                project specification
nginx/
  default.conf           Nginx frontend/API/static proxy configuration
skills/
  quiz-question-authoring/
                         local Codex skill for quiz content authoring
AGENTS.md                instructions for AI coding agents
docker-compose.yml       local Docker Compose setup
```

## Language Convention

Project language: English.

Use English for:

- documentation
- source code comments and docstrings
- agent instructions
- technical identifiers where practical

Use Polish for:

- user-facing UI copy
- quiz questions, answers, accepted answers, and explanations

## Run Locally

```bash
docker compose up --build
```

Default local URLs:

- frontend: `http://localhost:8081`
- backend API exposed on the host: `http://localhost:8001`

The Nginx frontend proxies `/api/`, `/health`, and `/static/` to the backend.

## Validate Quiz Content

On Windows, the project-preferred validator command is:

```powershell
py -3.12 backend/scripts/validate_quizzes.py
```

Fallback:

```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/validate_quizzes.ps1
```

The validator checks chapter metadata, topic files, question IDs, answer
structures, accepted answers, and local image references.

## Adding Quiz Content

Quiz content lives under:

```text
backend/app/data/chapters/
```

Each chapter should have:

- one `meta.json`
- one or more topic JSON files referenced by `meta.json`

Before changing quiz structure, question selection, or JSON schema, update
`docs/spec.md` and the validator as needed.

## Documentation

The main technical and product contract is:

- `docs/spec.md`

Agent-specific instructions are in:

- `AGENTS.md`

Human readers should start with this README and then use the specification for
details.

## Current Scope

Included:

- quiz list
- one-question-at-a-time quiz flow
- configurable target question count assembled from chapter topics
- randomized question and answer order
- optional images
- immediate feedback
- final score and restart
- content validation

Not included:

- login
- profiles
- persisted scores
- database-backed content
- admin UI
- multiplayer mode
- rankings
- timers
