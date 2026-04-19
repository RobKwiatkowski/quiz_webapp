from typing import List, Optional
from pydantic import BaseModel


class Answer(BaseModel):
    text: str
    is_correct: bool


class Question(BaseModel):
    id: str
    text: str
    image: Optional[str] = None
    explanation: Optional[str] = None
    answers: List[Answer]


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