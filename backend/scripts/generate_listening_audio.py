"""Generate local WAV assets for listening-fill quiz questions.

This is a development-only utility. The generated files are committed/deployed
with the application, so the runtime containers do not need a TTS dependency.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TOPIC = (
    REPOSITORY_ROOT
    / "backend"
    / "app"
    / "data"
    / "chapters"
    / "english-one-big-family"
    / "topic_3_listening_fill.json"
)
DEFAULT_STATIC_DIR = REPOSITORY_ROOT / "backend" / "app" / "static"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate listening quiz WAV files with Kokoro through sherpa-onnx."
    )
    parser.add_argument(
        "--model-dir",
        type=Path,
        required=True,
        help="Extracted kokoro-multi-lang-v1_0 model directory.",
    )
    parser.add_argument("--topic", type=Path, default=DEFAULT_TOPIC)
    parser.add_argument("--static-dir", type=Path, default=DEFAULT_STATIC_DIR)
    parser.add_argument(
        "--speaker-id",
        type=int,
        default=21,
        help="Kokoro speaker id; 21 is the British voice bf_emma.",
    )
    parser.add_argument("--speed", type=float, default=0.92)
    parser.add_argument("--threads", type=int, default=4)
    return parser.parse_args()


def required_model_file(model_dir: Path, name: str) -> Path:
    path = model_dir / name
    if not path.exists():
        raise FileNotFoundError(f"Missing Kokoro model asset: {path}")
    return path


def main() -> None:
    args = parse_args()
    try:
        import sherpa_onnx
        import soundfile as sf
    except ImportError as exc:
        raise SystemExit(
            "Install development dependencies from backend/scripts/requirements-tts.txt"
        ) from exc

    model_dir = args.model_dir.resolve()
    model = required_model_file(model_dir, "model.onnx")
    voices = required_model_file(model_dir, "voices.bin")
    tokens = required_model_file(model_dir, "tokens.txt")
    data_dir = required_model_file(model_dir, "espeak-ng-data")
    lexicon = required_model_file(model_dir, "lexicon-gb-en.txt")

    config = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                model=str(model),
                voices=str(voices),
                tokens=str(tokens),
                data_dir=str(data_dir),
                lexicon=str(lexicon),
            ),
            num_threads=args.threads,
            debug=False,
            provider="cpu",
        )
    )
    if not config.validate():
        raise SystemExit("Invalid sherpa-onnx Kokoro configuration")

    topic = json.loads(args.topic.read_text(encoding="utf-8"))
    questions = [
        question
        for question in topic.get("questions", [])
        if question.get("selection_type") == "listening_fill"
        and question.get("is_active", True)
    ]
    if not questions:
        raise SystemExit(f"No active listening_fill questions found in {args.topic}")

    tts = sherpa_onnx.OfflineTts(config)
    static_dir = args.static_dir.resolve()
    for question in questions:
        audio_reference = str(question.get("audio", ""))
        spoken_text = str(question.get("spoken_text", "")).strip()
        if not audio_reference.startswith("/static/") or not spoken_text:
            raise ValueError(f"Invalid audio metadata for question {question.get('id')}")

        destination = (static_dir / audio_reference.removeprefix("/static/")).resolve()
        if not destination.is_relative_to(static_dir):
            raise ValueError(f"Audio path escapes static directory: {audio_reference}")

        destination.parent.mkdir(parents=True, exist_ok=True)
        audio = tts.generate(
            text=spoken_text,
            sid=args.speaker_id,
            speed=args.speed,
        )
        sf.write(destination, audio.samples, audio.sample_rate, subtype="PCM_16")
        duration = len(audio.samples) / audio.sample_rate
        print(
            f"Generated {question['id']}: {destination} "
            f"({audio.sample_rate} Hz, {duration:.2f} s)"
        )


if __name__ == "__main__":
    main()
