# Edu Quiz for Kids

Lightweight educational quiz app for kids, designed for Raspberry Pi 3.

## Stack
- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: FastAPI
- Data: JSON files
- Hosting: Docker Compose + Nginx

## Language convention
- Project documentation, code comments, and agent instructions are written in English.
- User-facing UI copy and quiz learning content are written in Polish.

## MVP
- one question at a time
- configurable target question count assembled from chapter topics
- randomized answer order
- optional images
- immediate feedback
- final score shown at the end

## Run
```bash
docker compose up --build
```
