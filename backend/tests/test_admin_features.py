import base64
import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings
from app.main import app
from app.services import admin_content
from app.services.admin_auth import hash_password
from app.services.answer_check import score_open_answer_slots
from app.services.quiz_validation import validate_chapter_dir


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def make_data_dir(tmp_path: Path) -> Path:
    chapter_dir = tmp_path / "chapter-1"
    chapter_dir.mkdir(parents=True)
    write_json(
        chapter_dir / "meta.json",
        {
            "id": "chapter-1",
            "title": "Rozdział testowy",
            "description": "Opis",
            "category": "history",
            "age_group": "10-12",
            "target_question_count": 2,
            "questions_per_topic": 1,
            "topics": ["topic_1.json"],
        },
    )
    write_json(
        chapter_dir / "topic_1.json",
        {
            "topic_id": "topic-1",
            "topic_title": "Temat testowy",
            "questions": [
                {
                    "id": "q-existing-1",
                    "text": "Istniejące pytanie?",
                    "selection_type": "open",
                    "accepted_answers": ["tak"],
                    "explanation": "Wyjaśnienie",
                },
                {
                    "id": "q-existing-2",
                    "text": "Drugie pytanie?",
                    "selection_type": "single",
                    "answers": [
                        {"text": "A", "is_correct": True},
                        {"text": "B", "is_correct": False},
                    ],
                    "explanation": "Wyjaśnienie",
                },
            ],
        },
    )
    return tmp_path


def configure_admin(monkeypatch, data_dir: Path) -> None:
    monkeypatch.setattr(settings, "quiz_data_dir", str(data_dir))
    monkeypatch.setattr(settings, "admin_username", "admin")
    monkeypatch.setattr(settings, "admin_password_hash", hash_password("secret"))


def login(client: TestClient) -> None:
    response = client.post(
        "/api/admin/login",
        json={"username": "admin", "password": "secret"},
    )
    assert response.status_code == 200


def test_create_question_persists_and_creates_backup(tmp_path, monkeypatch):
    data_dir = make_data_dir(tmp_path)
    configure_admin(monkeypatch, data_dir)
    client = TestClient(app)
    login(client)

    response = client.post(
        "/api/admin/chapters/chapter-1/topics/topic-1/questions",
        json={
            "text": "Nowe pytanie?",
            "selection_type": "single",
            "answers": [
                {"text": "Dobra", "is_correct": True},
                {"text": "Zła", "is_correct": False},
            ],
        },
    )

    assert response.status_code == 200
    created = response.json()
    assert created["id"].startswith("q-")
    assert created["topic_id"] == "topic-1"
    assert "explanation" not in created
    topic_path = data_dir / "chapter-1" / "topic_1.json"
    data = json.loads(topic_path.read_text(encoding="utf-8"))
    assert any(question["id"] == created["id"] for question in data["questions"])
    assert topic_path.with_suffix(".json.bak").exists()


def test_create_order_question_persists_order_items(tmp_path, monkeypatch):
    data_dir = make_data_dir(tmp_path)
    configure_admin(monkeypatch, data_dir)
    client = TestClient(app)
    login(client)

    response = client.post(
        "/api/admin/chapters/chapter-1/topics/topic-1/questions",
        json={
            "text": "Ułóż wydarzenia w kolejności.",
            "selection_type": "order",
            "order_items": [
                {"text": "Pierwsze wydarzenie"},
                {"text": "Drugie wydarzenie"},
                {"text": "Trzecie wydarzenie"},
            ],
            "explanation": "Poprawna kolejność wynika z chronologii wydarzeń.",
        },
    )

    assert response.status_code == 200
    created = response.json()
    assert created["selection_type"] == "order"
    assert created["order_items"] == [
        {"id": "pierwsze-wydarzenie", "text": "Pierwsze wydarzenie", "position": 1},
        {"id": "drugie-wydarzenie", "text": "Drugie wydarzenie", "position": 2},
        {"id": "trzecie-wydarzenie", "text": "Trzecie wydarzenie", "position": 3},
    ]
    assert "answers" not in created


def test_create_matching_question_persists_matching_pairs(tmp_path, monkeypatch):
    data_dir = make_data_dir(tmp_path)
    configure_admin(monkeypatch, data_dir)
    client = TestClient(app)
    login(client)

    response = client.post(
        "/api/admin/chapters/chapter-1/topics/topic-1/questions",
        json={
            "text": "Dopasuj pojęcia do opisów.",
            "selection_type": "matching",
            "matching_pairs": [
                {"left": "Lewy jeden", "right": "Opis pierwszy"},
                {"left": "Lewy dwa", "right": "Opis drugi"},
            ],
            "explanation": "Każde pojęcie ma jeden pasujący opis.",
        },
    )

    assert response.status_code == 200
    created = response.json()
    assert created["selection_type"] == "matching"
    assert created["matching_pairs"] == [
        {"id": "lewy-jeden", "left": "Lewy jeden", "right": "Opis pierwszy"},
        {"id": "lewy-dwa", "left": "Lewy dwa", "right": "Opis drugi"},
    ]
    assert "answers" not in created


def test_create_single_image_question_copies_local_file(tmp_path, monkeypatch):
    data_dir = make_data_dir(tmp_path)
    static_dir = tmp_path / "static"
    configure_admin(monkeypatch, data_dir)
    monkeypatch.setattr(admin_content, "STATIC_DIR", static_dir)
    client = TestClient(app)
    login(client)

    response = client.post(
        "/api/admin/chapters/chapter-1/topics/topic-1/questions",
        json={
            "text": "Co widzisz na obrazku?",
            "selection_type": "single",
            "answers": [
                {"text": "A", "is_correct": True},
                {"text": "B", "is_correct": False},
            ],
            "image_upload": {
                "filename": "mapa.png",
                "content_base64": base64.b64encode(b"image-bytes").decode("ascii"),
            },
        },
    )

    assert response.status_code == 200
    created = response.json()
    assert created["image"].startswith("/static/images/admin/chapter-1/topic-1/")
    saved_path = static_dir / created["image"].removeprefix("/static/")
    assert saved_path.read_bytes() == b"image-bytes"


def test_create_open_image_question_accepts_url(tmp_path, monkeypatch):
    data_dir = make_data_dir(tmp_path)
    configure_admin(monkeypatch, data_dir)
    client = TestClient(app)
    login(client)

    response = client.post(
        "/api/admin/chapters/chapter-1/topics/topic-1/questions",
        json={
            "text": "Co przedstawia obrazek?",
            "selection_type": "open",
            "accepted_answers": ["mapa"],
            "explanation": "To mapa.",
            "image": "https://example.com/mapa.png",
        },
    )

    assert response.status_code == 200
    assert response.json()["image"] == "https://example.com/mapa.png"


def test_image_question_rejects_multiple_choice_type(tmp_path, monkeypatch):
    data_dir = make_data_dir(tmp_path)
    configure_admin(monkeypatch, data_dir)
    client = TestClient(app)
    login(client)

    response = client.post(
        "/api/admin/chapters/chapter-1/topics/topic-1/questions",
        json={
            "text": "Wybierz odpowiedzi.",
            "selection_type": "multiple",
            "answers": [
                {"text": "A", "is_correct": True},
                {"text": "B", "is_correct": True},
                {"text": "C", "is_correct": False},
            ],
            "image": "https://example.com/mapa.png",
        },
    )

    assert response.status_code == 400


def test_order_question_requires_explanation(tmp_path, monkeypatch):
    data_dir = make_data_dir(tmp_path)
    configure_admin(monkeypatch, data_dir)
    client = TestClient(app)
    login(client)

    response = client.post(
        "/api/admin/chapters/chapter-1/topics/topic-1/questions",
        json={
            "text": "Ułóż wydarzenia w kolejności.",
            "selection_type": "order",
            "order_items": [
                {"text": "Pierwsze wydarzenie"},
                {"text": "Drugie wydarzenie"},
            ],
        },
    )

    assert response.status_code == 400


def test_matching_question_requires_explanation(tmp_path, monkeypatch):
    data_dir = make_data_dir(tmp_path)
    configure_admin(monkeypatch, data_dir)
    client = TestClient(app)
    login(client)

    response = client.post(
        "/api/admin/chapters/chapter-1/topics/topic-1/questions",
        json={
            "text": "Dopasuj pojęcia do opisów.",
            "selection_type": "matching",
            "matching_pairs": [
                {"left": "Lewy jeden", "right": "Opis pierwszy"},
                {"left": "Lewy dwa", "right": "Opis drugi"},
            ],
        },
    )

    assert response.status_code == 400


def test_create_chapter_starts_empty_and_appears_in_list(tmp_path, monkeypatch):
    data_dir = make_data_dir(tmp_path)
    configure_admin(monkeypatch, data_dir)
    client = TestClient(app)
    login(client)

    response = client.post("/api/admin/chapters", json={"name": "Nowy rozdział"})

    assert response.status_code == 200
    created = response.json()
    assert created == {"id": "nowy-rozdzial", "title": "Nowy rozdział"}
    meta_path = data_dir / "nowy-rozdzial" / "meta.json"
    meta_data = json.loads(meta_path.read_text(encoding="utf-8"))
    assert meta_data["title"] == "Nowy rozdział"
    assert meta_data["topics"] == []

    chapters = client.get("/api/admin/chapters").json()
    assert created in chapters


def test_create_topic_adds_file_to_current_chapter(tmp_path, monkeypatch):
    data_dir = make_data_dir(tmp_path)
    configure_admin(monkeypatch, data_dir)
    client = TestClient(app)
    login(client)

    response = client.post(
        "/api/admin/chapters/chapter-1/topics",
        json={"name": "Nowy temat"},
    )

    assert response.status_code == 200
    created = response.json()
    assert created == {"id": "nowy-temat", "title": "Nowy temat"}

    chapter_dir = data_dir / "chapter-1"
    meta_data = json.loads((chapter_dir / "meta.json").read_text(encoding="utf-8"))
    assert "topic_2_nowy-temat.json" in meta_data["topics"]
    topic_data = json.loads((chapter_dir / "topic_2_nowy-temat.json").read_text(encoding="utf-8"))
    assert topic_data == {
        "topic_id": "nowy-temat",
        "topic_title": "Nowy temat",
        "questions": [],
    }
    assert (chapter_dir / "meta.json.bak").exists()


def test_empty_chapter_metadata_is_valid(tmp_path):
    chapter_dir = tmp_path / "empty-chapter"
    chapter_dir.mkdir(parents=True)
    write_json(
        chapter_dir / "meta.json",
        {
            "id": "empty-chapter",
            "title": "Pusty rozdział",
            "description": "Opis",
            "category": "history",
            "age_group": "10-12",
            "target_question_count": 2,
            "questions_per_topic": 1,
            "topics": [],
        },
    )

    result = validate_chapter_dir(chapter_dir, tmp_path / "static")

    assert result.errors == []


def test_update_question_keeps_stable_id(tmp_path, monkeypatch):
    data_dir = make_data_dir(tmp_path)
    configure_admin(monkeypatch, data_dir)
    client = TestClient(app)
    login(client)

    response = client.put(
        "/api/admin/chapters/chapter-1/topics/topic-1/questions/q-existing-1",
        json={
            "text": "Zmienione pytanie?",
            "selection_type": "open",
            "accepted_answers": ["tak", "oczywiście"],
            "explanation": "Nowe wyjaśnienie",
        },
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["id"] == "q-existing-1"
    assert updated["text"] == "Zmienione pytanie?"


def test_delete_question(tmp_path, monkeypatch):
    data_dir = make_data_dir(tmp_path)
    configure_admin(monkeypatch, data_dir)
    client = TestClient(app)
    login(client)

    response = client.delete(
        "/api/admin/chapters/chapter-1/topics/topic-1/questions/q-existing-1"
    )

    assert response.status_code == 200
    topic_data = json.loads((data_dir / "chapter-1" / "topic_1.json").read_text(encoding="utf-8"))
    assert all(question["id"] != "q-existing-1" for question in topic_data["questions"])


def test_unauthorized_admin_write_returns_401(tmp_path, monkeypatch):
    data_dir = make_data_dir(tmp_path)
    configure_admin(monkeypatch, data_dir)
    client = TestClient(app)

    response = client.post(
        "/api/admin/chapters/chapter-1/topics/topic-1/questions",
        json={"text": "Nie zapisuj", "selection_type": "open", "accepted_answers": ["x"]},
    )

    assert response.status_code == 401


def test_invalid_single_question_is_rejected(tmp_path, monkeypatch):
    data_dir = make_data_dir(tmp_path)
    configure_admin(monkeypatch, data_dir)
    client = TestClient(app)
    login(client)

    response = client.post(
        "/api/admin/chapters/chapter-1/topics/topic-1/questions",
        json={
            "text": "Błędne?",
            "selection_type": "single",
            "answers": [
                {"text": "A", "is_correct": True},
                {"text": "B", "is_correct": True},
            ],
            "explanation": "Wyjaśnienie",
        },
    )

    assert response.status_code == 400


def test_existing_open_question_with_accepted_answers_is_valid(tmp_path):
    data_dir = make_data_dir(tmp_path)
    result = validate_chapter_dir(data_dir / "chapter-1", data_dir / "static")

    assert result.errors == []


def test_single_question_without_explanation_is_valid(tmp_path):
    data_dir = make_data_dir(tmp_path)
    topic_path = data_dir / "chapter-1" / "topic_1.json"
    topic_data = json.loads(topic_path.read_text(encoding="utf-8"))
    topic_data["questions"][0] = {
        "id": "q-existing-1",
        "text": "Pytanie bez wyjaśnienia?",
        "selection_type": "single",
        "answers": [
            {"text": "A", "is_correct": True},
            {"text": "B", "is_correct": False},
        ],
    }
    write_json(topic_path, topic_data)

    result = validate_chapter_dir(data_dir / "chapter-1", data_dir / "static")

    assert result.errors == []


def test_multi_slot_open_question_is_valid(tmp_path):
    data_dir = make_data_dir(tmp_path)
    topic_path = data_dir / "chapter-1" / "topic_1.json"
    topic_data = json.loads(topic_path.read_text(encoding="utf-8"))
    topic_data["questions"][0] = {
        "id": "q-existing-1",
        "text": "Wymień dwie przyczyny.",
        "selection_type": "open",
        "answer_slots": [
            {"accepted_answers": ["pierwsza"]},
            {"accepted_answers": ["druga"]},
        ],
        "explanation": "Wyjaśnienie",
    }
    write_json(topic_path, topic_data)

    result = validate_chapter_dir(data_dir / "chapter-1", data_dir / "static")

    assert result.errors == []


def test_open_question_with_neither_answer_source_is_invalid(tmp_path):
    data_dir = make_data_dir(tmp_path)
    topic_path = data_dir / "chapter-1" / "topic_1.json"
    topic_data = json.loads(topic_path.read_text(encoding="utf-8"))
    topic_data["questions"][0] = {
        "id": "q-existing-1",
        "text": "Błędne pytanie.",
        "selection_type": "open",
        "explanation": "Wyjaśnienie",
    }
    write_json(topic_path, topic_data)

    result = validate_chapter_dir(data_dir / "chapter-1", data_dir / "static")

    assert any("accepted_answers or answer_slots" in error for error in result.errors)


def test_two_slot_question_can_score_partial_points():
    points = score_open_answer_slots(
        ["pierwsza", "inna"],
        [
            {"accepted_answers": ["pierwsza"]},
            {"accepted_answers": ["druga"]},
        ],
    )

    assert points == 1


def test_reversed_answer_order_still_gives_full_points():
    points = score_open_answer_slots(
        ["druga", "pierwsza"],
        [
            {"accepted_answers": ["pierwsza"]},
            {"accepted_answers": ["druga"]},
        ],
    )

    assert points == 2


def test_create_llm_question_persists_reference_answer(tmp_path, monkeypatch):
    data_dir = make_data_dir(tmp_path)
    configure_admin(monkeypatch, data_dir)
    client = TestClient(app)
    login(client)

    response = client.post(
        "/api/admin/chapters/chapter-1/topics/topic-1/questions",
        json={
            "text": "Wyjaśnij przyczynę.",
            "selection_type": "llm",
            "accepted_answers": ["Odpowiedź wzorcowa."],
            "explanation": "Wyjaśnienie",
        },
    )

    assert response.status_code == 200
    created = response.json()
    assert created["selection_type"] == "llm"
    assert created["accepted_answers"] == ["Odpowiedź wzorcowa."]
    assert "answers" not in created
    assert "answer_slots" not in created
