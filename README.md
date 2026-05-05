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
questions from the topic files, keeps questions grouped by the topic order in
`meta.json`, and returns the assembled quiz to the frontend.

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

- app: `http://localhost:8081`
- health check through Nginx: `http://localhost:8081/health`

The Nginx frontend proxies `/api/`, `/health`, and `/static/` to the backend.
The backend container is intentionally not exposed on a host port in the default
Compose file; it is reachable by Nginx on the internal Docker network.
Compose builds the backend image only. The frontend uses the official
`nginx:stable-alpine` image and bind-mounts `frontend/` plus
`nginx/default.conf`, which keeps rebuilds faster on Raspberry Pi.

## Docker Hub Images

GitHub Actions publishes production images to Docker Hub:

- `kwiaci/quiz-webapp-backend:latest`
- `kwiaci/quiz-webapp-frontend:latest`

The frontend image is a lightweight static Nginx image. It serves the files from
`frontend/` and writes `frontend/js/config.js` at container startup from the
`API_BASE_URL` environment variable. The image defaults `API_BASE_URL` to
`/quiz-api`, matching the Raspberry Pi Caddy route.

For a Raspberry Pi deployment behind Caddy, a typical Compose service can keep
the frontend internal to the Docker network:

```yaml
frontend:
  image: kwiaci/quiz-webapp-frontend:latest
  restart: unless-stopped
  environment:
    API_BASE_URL: /quiz-api
  expose:
    - "80"
```

In that setup Caddy should strip `/quiz` before proxying to the frontend and
strip `/quiz-api` before proxying to the backend.

`expose` is enough only when Caddy runs as a container on the same Docker
network. If Caddy runs directly on the Raspberry Pi host, bind the services to
localhost with `ports`, for example `127.0.0.1:8081:80` for the frontend and
`127.0.0.1:8000:8000` for the backend.

## Home Server Deployment

The default `docker-compose.yml` is suitable for a small home-server deployment:

- `frontend` publishes one host port: `8081:80`
- `backend` is not published to the host and is only reachable by the frontend
  proxy inside the Docker Compose network
- both services use `restart: unless-stopped`, so they come back after a reboot
  unless explicitly stopped
- the backend runs Uvicorn without `--reload`
- the backend code is copied into the Docker image instead of bind-mounted from
  the host filesystem
- frontend files are bind-mounted into the Nginx container instead of copied into
  a custom frontend image

To deploy on a home server:

```bash
docker compose up -d --build
```

Then open:

```text
http://SERVER_IP:8081
```

Useful maintenance commands:

```bash
docker compose ps
docker compose logs -f
docker compose down
docker compose up -d --build
```

If you need direct backend debugging from the host, temporarily add a backend port
mapping such as `8001:8000`, then use `http://SERVER_IP:8001/health`. For normal
use, keep the backend unexposed and access it through Nginx.

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
- question order grouped by chapter topic order
- randomized answer order for closed questions
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
