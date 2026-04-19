from typing import List, Literal, Optional
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
    case_sensitive: bool = False


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