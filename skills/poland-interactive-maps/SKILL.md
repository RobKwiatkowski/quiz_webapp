---
name: poland-interactive-maps
description: Create or update interactive Poland maps and city-marker map assets for this quiz app. Use for GeoJSON map questions, Polish region selection, and generated Poland SVG marker maps.
---

# Poland Interactive Maps

Use this skill for changes to Poland map questions and their local assets. It
documents the current, intentionally simple desktop map experience. Extend it
when the product gains a new map interaction pattern.

## Read First

Before making changes, read:

- `docs/spec.md`
- `backend/app/models/quiz.py`
- `backend/app/services/quiz_loader.py`
- `backend/app/services/quiz_validation.py`
- `frontend/js/quiz-map.js`
- `frontend/css/styles.css`
- the target chapter `meta.json` and topic JSON files

For generated city-marker maps, also read
`backend/scripts/generate_city_marker_maps.mjs`.

## Current Map Experience

- Maps are rendered as SVG inside the quiz and are intended for desktop use.
- Do not add zooming, panning, dragging, map controls, or external map
  libraries unless the user requests that product change.
- The interactive SVG has a `1000`-unit-wide viewBox, dynamic height with a
  minimum of `320`, and `24` units of internal padding. The displayed SVG fills
  its frame; the frame is `80%` of the available answer area and centered.
- Keep this sizing behavior for new Polish maps so questions feel consistent.

## Two Existing Patterns

### Interactive Region Questions

Use `selection_type: "map"` with `map_config`.

- Store a GeoJSON FeatureCollection under `backend/app/static/maps/` and refer
  to it using a `/static/maps/...` path.
- Each selectable feature needs a stable ASCII `properties.id`. The question's
  `map_config.target_feature_id` must match that exact id.
- Use `mode: "select"` when the learner clicks a region. Use `mode: "identify"`
  when the target is highlighted and the learner chooses from regular answers.
- `background_source` is optional and is another local `/static/...` GeoJSON
  layer. It is decorative and cannot be clicked.
- Preserve keyboard selection for clickable regions: Enter and Space activate
  the focused region.

### City-Marker Image Questions

Use an `open` question with an SVG image when a learner identifies a city marked
by a dot.

- The base region data is
  `backend/app/static/maps/poland-voivodeships.geojson`.
- Keep generated SVG files in `backend/app/static/images/geography/` with the
  name `poland-city-<ascii-city-id>.svg`.
- Add city coordinates to the `cities` array in
  `backend/scripts/generate_city_marker_maps.mjs`, then run that script with the
  bundled Node runtime. Do not manually move the dot in generated SVG files.
- Reference the asset from the question as
  `/static/images/geography/poland-city-<ascii-city-id>.svg`.
- Provide natural Polish `accepted_answers` variants, including a spelling
  without diacritics when useful and a common grammatical form such as
  `w <city>`.

## Validation

After changing an asset or map question:

1. Run the city-map generator if its coordinates or output are affected.
2. Run the bundled Python runtime with `backend/scripts/validate_quizzes.py`.
3. Confirm that question ids are unique within the chapter and every referenced
   topic file exists.
4. With the Compose app running, request every changed `/static/...` asset via
   `http://localhost:8081` and confirm HTTP `200` with the expected content
   type. The backend must bind-mount `backend/app/static` so newly generated
   files are served without rebuilding the image.
5. For renderer changes, inspect the map in the browser and verify region
   selection, feedback colors, keyboard access, and the absence of unwanted
   zoom or pan behavior.

