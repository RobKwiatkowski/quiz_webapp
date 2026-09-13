# React frontend migration workspace

This directory contains the new React frontend while the current `frontend/`
directory remains the deployed vanilla JavaScript application.

It intentionally has no production Docker or Nginx integration yet. The first
migration step only establishes a typed React and Vite foundation plus the
runtime `window.CONFIG` adapter. It must not change existing quiz behaviour.

The deployed frontend writes `js/config.js` when its Nginx container starts.
The React app loads the same path so the API base URL remains configurable at
runtime rather than being baked into a build artifact.

During development, Vite proxies `/api` and `/static` requests to the existing
Nginx frontend at `http://localhost:8081`. Start the current Docker Compose
stack first, then run the Vite development server.

After installing the declared Node dependencies, use:

```powershell
pnpm run typecheck
pnpm run build
```
