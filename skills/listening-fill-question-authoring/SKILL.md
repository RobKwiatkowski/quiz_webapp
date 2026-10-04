---
name: listening-fill-question-authoring
description: Create, edit, generate audio for, and validate Edu Quiz `listening_fill` questions. Use for prerecorded English listening tasks with two typed gaps, local Kokoro/sherpa-onnx audio assets, or listening-topic quiz pools. Do not use for generic TTS research or non-quiz audio.
---

# Listening-Fill Question Authoring

Create reproducible listening questions whose audio is generated during
development and deployed as a static asset. Do not add TTS dependencies or a
TTS service to the runtime containers.

## Read first

Before editing, read:

- `skills/quiz-question-authoring/SKILL.md`
- `docs/spec.md`, especially the `listening_fill` contract
- `backend/app/models/quiz.py`
- `backend/app/services/quiz_loader.py`
- `backend/app/services/quiz_validation.py`
- the target chapter's `meta.json`, every referenced topic file, and relevant tests

Follow the quiz-authoring approval workflow. When Codex invents sentences,
missing words, or accepted variants, present the complete proposed content and
wait for explicit approval before changing quiz JSON.

## Content contract

Each question must:

- use `selection_type: "listening_fill"`
- contain a simple English `spoken_text` with at most six whitespace-delimited words
- use `fill_mode: "open"`
- contain exactly two `fill_blanks`
- reference each blank exactly once in `text`, in the same order as `fill_blanks`
- use a local audio path under `/static/audio/...`
- include a short Polish `explanation` containing the complete English sentence
- have an ID unique within the chapter

Use A1-A2 language unless the user requests another level. Prefer one clear
learning objective per sentence. Avoid words that are hard to distinguish in
isolation, unnecessarily complex names, and gaps whose answer is ambiguous from
the recording. Add natural typed variants only when they express the same heard
answer, for example `didn't`, `didnt`, and `did not`.

Example question:

```json
{
  "id": "chapter-listening-01",
  "is_active": true,
  "text": "Yesterday I {{verb}} to {{place}}.",
  "selection_type": "listening_fill",
  "audio": "/static/audio/english/chapter/chapter-listening-01.wav",
  "spoken_text": "Yesterday I went to school.",
  "fill_mode": "open",
  "fill_blanks": [
    { "id": "verb", "accepted_answers": ["went"], "options": [] },
    { "id": "place", "accepted_answers": ["school"], "options": [] }
  ],
  "explanation": "Pełne zdanie: Yesterday I went to school."
}
```

## Topic and selection

Store the pool in a separate topic so it can be deactivated independently.
Use an ASCII-safe filename and `topic_id`. Put the topic before any topic that
must remain last, such as sentence translation evaluated by an LLM.

Set `max_questions_per_quiz` to the number requested by the user. If adding a
topic changes the number selected from existing topics, calculate and report the
new distribution before editing. Preserve existing questions and user changes;
use topic limits when an existing per-attempt constraint must remain true.

Update chapter tests to verify:

- topic order, pool size, and unique IDs
- exactly two open gaps and the six-word maximum
- the intended per-attempt distribution and fixed final-topic order
- every listening candidate can be drawn across deterministic random seeds

## Generate audio

Use the existing development utility instead of writing another generator:

```powershell
<tts-python> backend/scripts/generate_listening_audio.py `
  --model-dir <kokoro-multi-lang-v1_0-directory> `
  --topic <topic-json-path>
```

Install `backend/scripts/requirements-tts.txt` only in a development or temporary
environment. Reuse the Kokoro multi-language v1.0 model when available. The
generator defaults to British speaker `bf_emma` (speaker ID 21), speed `0.92`,
and PCM WAV output. Do not commit the model, virtual environment, or download
archive; commit only generated quiz audio assets.

After generation, verify that every referenced file exists and is readable,
uses a consistent sample rate, has a plausible non-zero duration and RMS level,
and does not clip. Present the generated files for manual listening approval;
signal statistics do not replace listening QA.

## Validate

Run the repository quiz validator with the bundled workspace Python as required
by `AGENTS.md`. Also run relevant chapter tests, the full backend test suite when
practical, and frontend type checking if the shared question contract or UI was
changed. Report unrelated pre-existing warnings separately.
