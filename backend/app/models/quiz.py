from typing import List, Optional, Literal
from pydantic import BaseModel


class Answer(BaseModel):
    text: str
    is_correct: bool


class Question(BaseModel):
    id: str
    text: str
    image: Optional[str] = None
    explanation: Optional[str] = None
    selection_type: Literal["single", "multiple", "open"] = "single"
    answers: List[Answer] = []
    accepted_answers: List[str] = []


class Quiz(BaseModel):
    id: str
    title: str
    description: str
    category: str
    age_group: str
    questions: List[Question]


class QuizListItem(BaseModel):
    id: str
    title: str
    description: str
    category: str
    age_group: str


class TopicFile(BaseModel):
    topic_id: str
    topic_title: str
    questions: List[Question]


class ChapterMeta(BaseModel):
    id: str
    title: str
    description: str
    category: str
    age_group: str
    target_question_count: int = 12
    questions_per_topic: int = 2
    topics: List[str]