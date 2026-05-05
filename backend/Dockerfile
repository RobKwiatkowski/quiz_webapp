# syntax=docker/dockerfile:1.7

FROM python:3.12-slim

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:0.5.30 /uv /uvx /bin/

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system --link-mode=copy -r requirements.txt

COPY app ./app
