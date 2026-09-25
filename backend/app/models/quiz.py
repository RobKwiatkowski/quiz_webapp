"""Pydantic data models for quizzes, chapters, and topics."""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field, model_validator


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


class OperationOrderConfig(BaseModel):
    """Concept family used to generate an order-of-operations question."""

    family: Literal["precedence", "parentheses", "powers", "left_to_right"]


class OperationOrderChoice(BaseModel):
    """One operation that may be selected as the next calculation step."""

    id: str
    text: str


class OperationOrderStep(BaseModel):
    """One reduction in a generated order-of-operations solution."""

    expression: str
    choices: List[OperationOrderChoice]
    correct_choice_id: str
    focus_prefix: str
    focus: str
    focus_suffix: str
    expected_result: int
    reduced_expression: str
    rule: str


class WrittenMultiplicationConfig(BaseModel):
    """Operand range used to generate a written-multiplication question."""

    min_factor: int = Field(ge=10, le=9999)
    max_factor: int = Field(ge=10, le=9999)
    max_total_digits: int = Field(default=6, ge=4, le=6)
    easy_max_total_digits: int = Field(default=4, ge=4, le=6)
    easy_max_partial_product: int = Field(default=100, ge=10, le=9999)

    @model_validator(mode="after")
    def validate_factor_range(self) -> "WrittenMultiplicationConfig":
        """Ensures the range can produce a pair within the digit limit."""
        if self.min_factor > self.max_factor:
            raise ValueError("min_factor must not exceed max_factor")
        if len(str(self.min_factor)) * 2 > self.max_total_digits:
            raise ValueError("factor range cannot satisfy max_total_digits")
        if len(str(self.min_factor)) * 2 > self.easy_max_total_digits:
            raise ValueError("factor range cannot satisfy easy_max_total_digits")
        if self.easy_max_total_digits > self.max_total_digits:
            raise ValueError("easy_max_total_digits must not exceed max_total_digits")
        return self


class TimedMultiplicationConfig(BaseModel):
    """Factor range and answer time used for multiplication-table practice."""

    min_factor: int = Field(default=3, ge=3, le=9)
    max_factor: int = Field(default=9, ge=3, le=9)
    time_limit_seconds: int = Field(default=5, ge=1, le=60)

    @model_validator(mode="after")
    def validate_factor_range(self) -> "TimedMultiplicationConfig":
        """Ensures the lower factor limit does not exceed the upper limit."""
        if self.min_factor > self.max_factor:
            raise ValueError("min_factor must not exceed max_factor")
        return self


class TimedDivisionConfig(BaseModel):
    """Divisor, quotient, and answer time used for division-table practice."""

    min_divisor: int = Field(default=3, ge=3, le=9)
    max_divisor: int = Field(default=9, ge=3, le=9)
    min_quotient: int = Field(default=3, ge=3, le=9)
    max_quotient: int = Field(default=9, ge=3, le=9)
    time_limit_seconds: int = Field(default=10, ge=1, le=60)

    @model_validator(mode="after")
    def validate_ranges(self) -> "TimedDivisionConfig":
        """Ensures both generated ranges are ordered."""
        if self.min_divisor > self.max_divisor:
            raise ValueError("min_divisor must not exceed max_divisor")
        if self.min_quotient > self.max_quotient:
            raise ValueError("min_quotient must not exceed max_quotient")
        return self


class WrittenDivisionConfig(BaseModel):
    """Ranges used to generate an exact written-division question."""

    min_divisor: int = Field(default=2, ge=2, le=9999)
    max_divisor: int = Field(default=99, ge=2, le=9999)
    min_quotient: int = Field(default=10, ge=2, le=9999)
    max_quotient: int = Field(default=9999, ge=2, le=9999)
    max_dividend_digits: int = Field(default=6, ge=2, le=6)
    easy_min_divisor: int = Field(default=3, ge=2, le=99)
    easy_max_divisor: int = Field(default=10, ge=2, le=99)
    medium_min_divisor: int = Field(default=8, ge=2, le=99)
    medium_max_divisor: int = Field(default=15, ge=2, le=99)
    easy_max_quotient: int = Field(default=999, ge=2, le=9999)
    easy_max_dividend_digits: int = Field(default=4, ge=2, le=6)
    easy_max_intermediate_value: int = Field(default=100, ge=10, le=9999)

    @model_validator(mode="after")
    def validate_ranges(self) -> "WrittenDivisionConfig":
        """Ensures at least one divisor/quotient pair fits the dividend limit."""
        if self.min_divisor > self.max_divisor:
            raise ValueError("min_divisor must not exceed max_divisor")
        if self.min_quotient > self.max_quotient:
            raise ValueError("min_quotient must not exceed max_quotient")
        if len(str(self.min_divisor)) + len(str(self.min_quotient)) > self.max_dividend_digits:
            raise ValueError("configured ranges cannot satisfy max_dividend_digits")
        if self.easy_min_divisor < self.min_divisor:
            raise ValueError("easy_min_divisor must not be lower than min_divisor")
        if self.easy_min_divisor > self.easy_max_divisor:
            raise ValueError("easy_min_divisor must not exceed easy_max_divisor")
        if self.easy_max_divisor > min(self.max_divisor, 99):
            raise ValueError("easy_max_divisor must not exceed max_divisor or 99")
        if self.medium_min_divisor < self.min_divisor:
            raise ValueError("medium_min_divisor must not be lower than min_divisor")
        if self.medium_min_divisor > self.medium_max_divisor:
            raise ValueError("medium_min_divisor must not exceed medium_max_divisor")
        if self.medium_max_divisor > min(self.max_divisor, 99):
            raise ValueError("medium_max_divisor must not exceed max_divisor or 99")
        if self.easy_max_quotient < self.min_quotient:
            raise ValueError("easy_max_quotient must not be lower than min_quotient")
        if self.easy_max_quotient > self.max_quotient:
            raise ValueError("easy_max_quotient must not exceed max_quotient")
        if self.easy_max_dividend_digits > self.max_dividend_digits:
            raise ValueError("easy_max_dividend_digits must not exceed max_dividend_digits")
        if len(str(self.min_divisor * self.min_quotient)) > self.easy_max_dividend_digits:
            raise ValueError("configured ranges cannot satisfy easy_max_dividend_digits")
        return self


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
        is_active: Whether the question participates in quiz assembly.
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
        correct_century_half: Chronological half of the generated century.
        order_items: Items to arrange for order questions.
        matching_pairs: Left/right pairs for matching questions.
        map_config: Configuration for map questions.
        hotspot_config: Configuration for interactive SVG diagram questions.
        topic_id: Optional topic identifier used by the admin editor.
    """

    id: str
    is_active: bool = True
    text: str
    source_text: Optional[str] = None
    context: Optional[QuestionContext] = None
    image: str | List[str] | None = None
    explanation: Optional[str] = None
    selection_type: Literal[
        "single", "multiple", "true_false", "open", "llm", "order", "matching", "map", "hotspot", "century", "fill", "written_multiplication", "written_division", "timed_multiplication", "timed_division", "operation_order"
    ] = "single"
    answers: List[Answer] = Field(default_factory=list)
    accepted_answers: List[str] = Field(default_factory=list)
    answer_slots: List[AnswerSlot] = Field(default_factory=list)
    fill_mode: Optional[Literal["select", "open"]] = None
    fill_blanks: List[FillBlank] = Field(default_factory=list)
    century_config: Optional[CenturyConfig] = None
    century_year: Optional[int] = None
    correct_century: Optional[int] = None
    correct_century_half: Optional[Literal["first", "second"]] = None
    operation_order_config: Optional[OperationOrderConfig] = None
    operation_order_difficulty: Optional[Literal["easy", "medium", "pro"]] = None
    operation_order_expression: Optional[str] = None
    operation_order_steps: List[OperationOrderStep] = Field(default_factory=list)
    operation_order_result: Optional[int] = None
    written_multiplication_config: Optional[WrittenMultiplicationConfig] = None
    timed_multiplication_config: Optional[TimedMultiplicationConfig] = None
    timed_division_config: Optional[TimedDivisionConfig] = None
    multiplicand: Optional[int] = None
    multiplier: Optional[int] = None
    written_division_config: Optional[WrittenDivisionConfig] = None
    dividend: Optional[int] = None
    divisor: Optional[int] = None
    quotient: Optional[int] = None
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
        difficulty_levels: Difficulty choices shown before starting the quiz.
        questions: Final ordered list of selected questions.
    """

    id: str
    title: str
    description: str
    category: str
    age_group: str
    chapter_number: Optional[int] = None
    difficulty_levels: List[Literal["easy", "medium", "pro"]] = Field(default_factory=list)
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
        difficulty_levels: Difficulty choices shown before starting the quiz.
    """

    id: str
    title: str
    description: str
    category: str
    age_group: str
    chapter_number: Optional[int] = None
    difficulty_levels: List[Literal["easy", "medium", "pro"]] = Field(default_factory=list)


class TopicFile(BaseModel):
    """Structure of a topic JSON file within a chapter.

    Attributes:
        topic_id: Unique topic identifier inside a chapter.
        topic_title: Human-readable topic title.
        is_active: Whether questions from this topic may be included in a quiz.
        questions: Questions available for this topic.
    """

    topic_id: str
    topic_title: str
    is_active: bool = True
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
        difficulty_levels: Difficulty choices exposed by this chapter.
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
    difficulty_levels: List[Literal["easy", "medium", "pro"]] = Field(default_factory=list)
    target_question_count: int = 12
    questions_per_topic: int = 2
    topics: List[str]

    @model_validator(mode="after")
    def validate_difficulty_levels(self) -> "ChapterMeta":
        """Ensures every configured difficulty is exposed at most once."""
        if len(self.difficulty_levels) != len(set(self.difficulty_levels)):
            raise ValueError("difficulty_levels must not contain duplicates")
        return self

