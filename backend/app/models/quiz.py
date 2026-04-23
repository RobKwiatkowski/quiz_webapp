"""Pydantic data models for quizzes, chapters, and topics."""

from typing import List, Optional, Literal
from pydantic import BaseModel


class Answer(BaseModel):
    """Single answer option for choice-based questions.

    Attributes:
        text: Answer label displayed to a user.
        is_correct: Marks whether this option is correct.
    """

    text: str
    is_correct: bool


class Question(BaseModel):
    """Question schema supporting single, multiple, and open answers.

    Attributes:
        id: Unique question identifier.
        text: Question text shown in the UI.
        image: Optional image path or URL.
        explanation: Optional explanation shown after answering.
        selection_type: Interaction type (single, multiple, or open).
        answers: Options for single/multiple questions.
        accepted_answers: Accepted values for open questions.
    """

    id: str
    text: str
    image: Optional[str] = None
    explanation: Optional[str] = None
    selection_type: Literal["single", "multiple", "open"] = "single"
    answers: List[Answer] = []
    accepted_answers: List[str] = []


class Quiz(BaseModel):
    """Complete quiz payload returned to the quiz page.

    Attributes:
        id: Unique quiz identifier.
        title: Quiz title.
        description: Short quiz description.
        category: Quiz domain/category.
        age_group: Intended age group label.
        questions: Final ordered list of selected questions.
    """

    id: str
    title: str
    description: str
    category: str
    age_group: str
    questions: List[Question]


class QuizListItem(BaseModel):
    """Lightweight quiz representation used on the list page.

    Attributes:
        id: Unique quiz identifier.
        title: Quiz title.
        description: Short quiz description.
        category: Quiz domain/category.
        age_group: Intended age group label.
    """

    id: str
    title: str
    description: str
    category: str
    age_group: str


class TopicFile(BaseModel):
    """Structure of a topic JSON file within a chapter.

    Attributes:
        topic_id: Unique topic identifier inside a chapter.
        topic_title: Human-readable topic title.
        questions: Questions available for this topic.
    """

    topic_id: str
    topic_title: str
    questions: List[Question]


class ChapterMeta(BaseModel):
    """Chapter-level metadata used to compose a final quiz.

    Attributes:
        id: Unique chapter/quiz identifier.
        title: Chapter title.
        description: Chapter description.
        category: Quiz domain/category.
        age_group: Intended age group label.
        target_question_count: Desired number of questions in final quiz.
        questions_per_topic: Legacy per-topic pick count used by validators.
        topics: Topic JSON filenames that belong to this chapter.
    """

    id: str
    title: str
    description: str
    category: str
    age_group: str
    target_question_count: int = 12
    questions_per_topic: int = 2
    topics: List[str]
