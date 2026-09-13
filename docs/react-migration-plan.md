# React Migration Plan

## Recommendation

Migrate the frontend in the existing repository, using a dedicated Git branch and
Git worktree. Do not create an independent repository for the migration.

The FastAPI API, JSON quiz content, validator, static assets, Nginx routing, and
Docker deployment are shared contracts. Keeping one repository makes each
frontend increment testable against the same backend and avoids a later,
high-risk merge of two diverging codebases.

Create a separate repository only if the new application is intentionally a
different product with a different API or data model. That is not the case for
this migration.

## Scope and non-goals

The migration replaces the public static frontend and, later, the admin static
frontend. It does not change:

- FastAPI endpoints or authentication behaviour;
- the quiz JSON schema, question-selection logic, or content validator;
- the ownership of quiz assembly by the backend;
- Nginx as the production static-file server.

React is a frontend rendering and state-management change. It does not by itself
provide persisted scores, profiles, a database, or new backend capabilities.

## Before starting

1. Make the current `main` branch a deliberate, working checkpoint. Commit the
   intended current changes separately, or leave unrelated experimental files
   out of the migration branch.
2. Run the quiz validator and the backend test suite on that checkpoint.
3. Record a short manual acceptance checklist for all question types:
   `single`, `multiple`, `open`, `llm`, `order`, `matching`, `map`, and
   `hotspot`.
4. Preserve the current frontend in the branch history until all acceptance
   checks pass. Do not delete it at the start of the work.

Suggested setup after the checkpoint:

```powershell
git switch main
git switch -c codex/react-migration
git worktree add ..\quiz_webapp-react codex/react-migration
```

The original worktree can continue to run the working vanilla frontend while
the second worktree contains the migration. This is safer than copying the
repository directory by hand because Git retains one common history.

## Target frontend architecture

Use React, TypeScript, and Vite. Keep the dependency set intentionally small.

```text
frontend/
  src/
    api/                 API client and runtime configuration
    components/
      quiz/              Quiz shell, progress, feedback, result screen
      questions/         One component per question type
      subjects/          Subject and quiz-list components
    features/
      quiz/              useReducer state, scoring, answer checking
      admin/             Added in the second phase
    pages/               Subject, quiz, math, and admin pages
    styles/              Existing CSS migrated incrementally
  public/
    config.js            Runtime API base URLs
```

Use `useReducer` for the quiz session first. A global state library is not
needed for a one-player quiz. Keep score calculation and non-DOM answer-checking
functions as pure TypeScript functions so they are easy to unit test.

React Router is useful once the several HTML pages become one application. It
requires an Nginx SPA fallback for frontend routes, while `/api/`, `/static/`,
and `/health` must retain their existing proxy behaviour.

## Runtime configuration and deployment

Do not turn `API_BASE_URL` into a value fixed at build time. The current
deployment writes `js/config.js` when the Nginx container starts; retain that
pattern. Load `/js/config.js` before the React bundle and expose the values
through a typed `window.CONFIG` wrapper.

Production remains lightweight:

```text
browser -> Nginx static React files -> /api proxy -> FastAPI
```

Node.js and Vite are required to build the frontend, not to serve it. A
multi-stage frontend image can build assets with Node and copy only `dist/` into
the final `nginx:stable-alpine` image. For the Raspberry Pi, build the image on
a more capable machine or in CI when practical; the final runtime image still
contains only Nginx and static files.

## Incremental migration phases

### Phase 0: Characterization and safety net

- Add frontend unit-test tooling (Vitest is sufficient initially).
- Write tests for score calculation, Polish answer normalization, multi-slot
  answer matching, grades, and progress percentages.
- Add a browser-level smoke checklist or automated tests for every question
  type, including keyboard Enter behaviour and restart.
- Keep the backend validator and Python tests unchanged and run them on every
  migration increment.

Exit criterion: current behaviour is documented and key rules have executable
tests before UI code changes.

### Phase 1: Build foundation without changing the deployed UI

- Add Vite, React, TypeScript, linting, and test scripts.
- Implement the typed API client around the existing endpoints.
- Implement the runtime `window.CONFIG` adapter.
- Add the React entry point alongside the existing HTML/JS frontend.
- Build the output in Docker and verify that Nginx still proxies API and static
  requests correctly.

Exit criterion: a React hello page builds and deploys without changing the
current quiz route.

### Phase 2: Public navigation and quiz lists

- Migrate the start, history, geography, biology, and math pages.
- Replace duplicated section HTML with data-driven subject components.
- Preserve existing URLs or add redirects so bookmarks continue to work.

Exit criterion: lists show the same quizzes, category filtering, loading, and
error states as the vanilla pages.

### Phase 3: Quiz core

- Migrate quiz state into a reducer: quiz payload, current index, answer draft,
  answered state, earned points, and result state.
- Migrate shared quiz UI: navigation, progress, image/context display,
  feedback, score, grade, restart, and Enter-key behaviour.
- Implement `SingleQuestion`, `MultipleQuestion`, `OpenQuestion`,
  `OrderQuestion`, and `MatchingQuestion` components.
- Compare scores and feedback with the vanilla implementation using the same
  backend payloads.

Exit criterion: all non-map public quizzes have behaviour parity.

### Phase 4: Interactive visual questions

- Migrate GeoJSON rendering into a `MapQuestion` component.
- Migrate SVG sanitization, focus management, and feedback into a
  `HotspotQuestion` component.
- Keep direct SVG/GeoJSON DOM creation inside well-contained React refs or
  components; React does not remove the need for this specialised rendering.
- Add interaction tests for correct and incorrect clicks, keyboard activation,
  disabled state, and correct-region marking.

Exit criterion: map and hotspot questions match current behaviour and remain
keyboard accessible.

### Phase 5: Admin application

- Move the authenticated admin editor into a separate React entry point or a
  protected `/admin` route.
- Model the question editor as a discriminated TypeScript union keyed by
  `selection_type`.
- Create reusable field-array components for answers, accepted answers, slots,
  order items, and matching pairs.
- Preserve backend validation as the authoritative write validation; show its
  error messages clearly in the UI.
- Add unsaved-change protection and a question preview only after parity is
  achieved.

Exit criterion: every create, edit, image upload, and delete action works with
the existing admin API and session cookie.

### Phase 6: Cutover and cleanup

- Route production traffic to the React frontend.
- Run the complete acceptance checklist, backend tests, quiz validator, and
  container smoke tests.
- Retain a tagged pre-React release for rollback.
- Remove legacy HTML/JS only after at least one verified deployment cycle.

## Suggested component boundary

```text
QuizPage
  QuizHeader
  ProgressBar
  QuestionRenderer
    SingleQuestion | MultipleQuestion | OpenQuestion
    OrderQuestion | MatchingQuestion | MapQuestion | HotspotQuestion
    LlmQuestion
  FeedbackPanel
  QuizActions
  ResultScreen
```

`QuestionRenderer` chooses a component from `selection_type`; it should not
know JSON file names or quiz-selection rules. Those remain backend concerns.

## Definition of done for each pull request

- The change is small enough to review and revert independently.
- Existing API routes and payload shapes remain compatible.
- `backend/scripts/validate_quizzes.py` passes.
- Backend tests pass.
- Frontend type check, lint, unit tests, and production build pass.
- The relevant manual or browser-level acceptance cases pass.
- No new feature is silently added while reproducing current behaviour.

## Rollback

Keep the previous frontend release tagged. Because the backend contract remains
unchanged, rollback means serving the prior static frontend image or restoring
the former Nginx-mounted frontend directory; it does not require a content or
database migration.
