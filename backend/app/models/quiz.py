"""Pydantic data models for quizzes, chapters, and topics."""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class Answer(BaseModel):
    """Single answer option for choice-based questions.

    Attributes:
        text: Answer label displayed to a user.
        is_correct: Marks whether this option is correct.
    """

    text: str
    is_correct: bool


class OrderItem(BaseModel):
    """Single item used by order-based questions.

    Attributes:
        id: Stable item identifier used for checking order.
        text: Item label displayed to a user.
        position: Correct 1-based position in the final sequence.
    """

    id: str
    text: str
    position: int


class MatchingPair(BaseModel):
    """Single pair used by matching questions.

    Attributes:
        id: Stable pair identifier used for checking the selected match.
        left: Item label displayed in the left column.
        right: Matching item label displayed as a right-column choice.
    """

    id: str
    left: str
    right: str


class QuestionContext(BaseModel):
    """Optional plain text context displayed before a question.

    Attributes:
        text: Context passage shown above the question.
        source: Optional source attribution.
    """

    text: str
    source: Optional[str] = None


class AnswerSlot(BaseModel):
    """One answer slot for multi-field open questions.

    Attributes:
        accepted_answers: Accepted values for this slot.
    """

    accepted_answers: List[str]


class FillBlank(BaseModel):
    """One named gap in a fill-in-the-blanks question.

    ``id`` is referenced from the question text as ``{{id}}``. In ``select``
    mode, ``options`` contains the values displayed in the select control.
    """

    id: str
    accepted_answers: List[str]
    options: List[str] = Field(default_factory=list)


class CenturyConfig(BaseModel):
    """Range of years used to generate a century-calculation question."""

    min_year: int
    max_year: int


class WrittenMultiplicationConfig(BaseModel):
    """Operand range used to generate a written-multiplication question."""

    min_factor: int = Field(ge=10, le=9999)
    max_factor: int = Field(ge=10, le=9999)


class MapConfig(BaseModel):
    """Configuration for map-based questions.

    Attributes:
        source: Local GeoJSON asset path.
        mode: Map interaction mode.
        target_feature_id: Stable feature identifier from properties.id.
        interaction: Optional map target shape. Defaults to region selection.
    """

    source: str
    mode: Literal["select", "identify"]
    target_feature_id: str
    background_source: Optional[str] = None
    interaction: Literal["region", "line"] = "region"


class HotspotConfig(BaseModel):
    """Configuration for questions answered on an interactive SVG diagram.

    Attributes:
        source: Local SVG asset path.
        target_hotspot_id: Stable identifier of the correct clickable region.
    """

    source: str
    target_hotspot_id: str


class Question(BaseModel):
    """Question schema supporting all quiz answer interaction types.

    Attributes:
        id: Unique question identifier.
        text: Question text shown in the UI.
        source_text: Optional source passage shown above the question.
        context: Optional plain text context passage with source attribution.
        image: Optional image path, URL, or list of image references.
        explanation: Optional explanation shown after an incorrect answer.
        selection_type: Interaction type.
        answers: Options for single/multiple and true/false questions.
        accepted_answers: Accepted values for open questions.
        answer_slots: Slots for multi-field open questions.
        fill_mode: Interaction mode for fill-in-the-blanks questions.
        fill_blanks: Named gaps used by fill-in-the-blanks questions.
        century_config: Year range used by generated century questions.
        century_year: Generated signed year; negative values are BCE.
        correct_century: Correct century number for a generated century question.
        order_items: Items to arrange for order questions.
        matching_pairs: Left/right pairs for matching questions.
        map_config: Configuration for map questions.
        hotspot_config: Configuration for interactive SVG diagram questions.
        topic_id: Optional topic identifier used by the admin editor.
    """

    id: str
    text: str
    source_text: Optional[str] = None
    context: Optional[QuestionContext] = None
    image: str | List[str] | None = None
    explanation: Optional[str] = None
    selection_type: Literal[
        "single", "multiple", "true_false", "open", "llm", "order", "matching", "map", "hotspot", "century", "fill", "written_multiplication"
    ] = "single"
    answers: List[Answer] = Field(default_factory=list)
    accepted_answers: List[str] = Field(default_factory=list)
    answer_slots: List[AnswerSlot] = Field(default_factory=list)
    fill_mode: Optional[Literal["select", "open"]] = None
    fill_blanks: List[FillBlank] = Field(default_factory=list)
    century_config: Optional[CenturyConfig] = None
    century_year: Optional[int] = None
    correct_century: Optional[int] = None
    written_multiplication_config: Optional[WrittenMultiplicationConfig] = None
    multiplicand: Optional[int] = None
    multiplier: Optional[int] = None
    order_items: List[OrderItem] = Field(default_factory=list)
    matching_pairs: List[MatchingPair] = Field(default_factory=list)
    map_config: Optional[MapConfig] = None
    hotspot_config: Optional[HotspotConfig] = None
    topic_id: Optional[str] = None


class Quiz(BaseModel):
    """Complete quiz payload returned to the quiz page.

    Attributes:
        id: Unique quiz identifier.
        title: Quiz title.
        description: Short quiz description.
        category: Quiz domain/category.
        age_group: Intended age group label.
        chapter_number: Optional number displayed in the chapter badge.
        questions: Final ordered list of selected questions.
    """

    id: str
    title: str
    description: str
    category: str
    age_group: str
    chapter_number: Optional[int] = None
    questions: List[Question]


class QuizListItem(BaseModel):
    """Lightweight quiz representation used on the list page.

    Attributes:
        id: Unique quiz identifier.
        title: Quiz title.
        description: Short quiz description.
        category: Quiz domain/category.
        age_group: Intended age group label.
        chapter_number: Optional number displayed in the chapter badge.
    """

    id: str
    title: str
    description: str
    category: str
    age_group: str
    chapter_number: Optional[int] = None


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
        chapter_number: Optional number displayed in the chapter badge.
        target_question_count: Desired number of questions in final quiz.
        questions_per_topic: Legacy per-topic pick count used by validators.
        topics: Topic JSON filenames that belong to this chapter.
    """

    id: str
    title: str
    description: str
    category: str
    age_group: str
    chapter_number: Optional[int] = Field(default=None, ge=1)
    target_question_count: int = 12
    questions_per_topic: int = 2
    topics: List[str]

