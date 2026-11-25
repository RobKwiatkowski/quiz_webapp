"""Verify LLM filtering happens before quiz selection."""

import unittest
from pathlib import Path
from unittest.mock import patch

from app.models.quiz import ChapterMeta, Question, TopicFile
from app.services.quiz_loader import build_quiz_from_chapter


class LlmQuestionFlagTest(unittest.TestCase):
    def test_enabled_disabled_and_backfill(self):
        meta = ChapterMeta(id="test", title="Test", description="", category="test",
                           age_group="test", target_question_count=2, topics=["a", "b"])
        topics = {
            "a": TopicFile(topic_id="a", topic_title="A", questions=[
                Question(id="llm", text="LLM", selection_type="llm"),
            ]),
            "b": TopicFile(topic_id="b", topic_title="B", questions=[
                Question(id="one", text="One"), Question(id="two", text="Two"),
            ]),
        }
        with patch("app.services.quiz_loader.load_chapter_meta", return_value=meta), \
             patch("app.services.quiz_loader.load_topic_file", side_effect=lambda _, name: topics[name]):
            with patch("app.services.quiz_loader.settings.llm_questions_enabled", True):
                enabled = build_quiz_from_chapter(Path("unused"))
            with patch("app.services.quiz_loader.settings.llm_questions_enabled", False):
                disabled = build_quiz_from_chapter(Path("unused"))
                topics["b"].questions.clear()
                empty = build_quiz_from_chapter(Path("unused"))

        self.assertIn("llm", {question.id for question in enabled.questions})
        self.assertEqual({question.id for question in disabled.questions}, {"one", "two"})
        self.assertEqual(empty.questions, [])
