# React frontend

This directory contains the production React/TypeScript frontend for Edu Quiz.
The application is built with Vite and served as static files by Nginx in the
Docker image.

Runtime API URLs are kept configurable through `public/js/config.js`. The Docker
entrypoint rewrites the built `js/config.js` file from environment variables
when the container starts, so values such as `API_BASE_URL` are not baked into
the bundle.

Useful local commands:

```powershell
pnpm install
pnpm run typecheck
pnpm run build
```
