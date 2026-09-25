import json
import re
from pathlib import Path

from app.services.math.operation_order import (
    ExpressionBuilder,
    build_solution_steps,
    evaluate_expression,
    render_expression,
)
from app.services.quiz_loader import build_quiz_from_chapter
from app.services.quiz_validation import ValidationResult, validate_operation_order_config


CHAPTER_DIR = (
    Path(__file__).resolve().parents[1]
    / "app"
    / "data"
    / "chapters"
    / "math-order-of-operations"
)
TARGET_QUESTION_COUNT = json.loads(
    (CHAPTER_DIR / "meta.json").read_text(encoding="utf-8")
)["target_question_count"]


def test_basic_precedence_solution_starts_with_multiplication() -> None:
    builder = ExpressionBuilder()
    expression = builder.operation(
        "add",
        builder.number(2),
        builder.operation("multiply", builder.number(2), builder.number(2)),
    )

    steps, result = build_solution_steps(expression, "precedence")

    assert [step.expression for step in steps] == ["2 + 2 × 2", "2 + 4"]
    assert [step.focus for step in steps] == ["2 × 2", "2 + 4"]
    assert [step.expected_result for step in steps] == [4, 6]
    assert result == 6


def test_parentheses_change_the_first_solution_step() -> None:
    builder = ExpressionBuilder()
    expression = builder.operation(
        "multiply",
        builder.operation(
            "add",
            builder.number(2),
            builder.number(2),
            grouped=True,
        ),
        builder.number(2),
    )

    steps, result = build_solution_steps(expression, "parentheses")

    assert [step.expression for step in steps] == ["(2 + 2) × 2", "4 × 2"]
    assert [step.focus for step in steps] == ["(2 + 2)", "4 × 2"]
    assert [step.expected_result for step in steps] == [4, 8]
    assert result == 8


def test_choices_show_only_the_local_fragment_around_each_operator() -> None:
    builder = ExpressionBuilder()
    multiplication = builder.operation(
        "multiply",
        builder.number(30),
        builder.number(10),
    )
    division = builder.operation("divide", multiplication, builder.number(10))
    expression = builder.operation("add", division, builder.number(10))

    steps, _ = build_solution_steps(expression, "precedence")

    assert [choice.text for choice in steps[0].choices] == [
        "dodawanie: 10 + 10",
        "dzielenie: 10 : 10",
        "mnożenie: 30 × 10",
    ]


def test_supported_cubes_and_fourth_power_render_and_evaluate() -> None:
    builder = ExpressionBuilder()
    cube_of_two = builder.operation("cube", builder.number(2))
    cube_of_three = builder.operation("cube", builder.number(3))
    fourth_power_of_two = builder.operation("fourth_power", builder.number(2))

    assert (render_expression(cube_of_two), evaluate_expression(cube_of_two)) == ("2³", 8)
    assert (render_expression(cube_of_three), evaluate_expression(cube_of_three)) == ("3³", 27)
    assert (render_expression(fourth_power_of_two), evaluate_expression(fourth_power_of_two)) == ("2⁴", 16)


def test_generated_levels_have_distinct_minimum_step_counts() -> None:
    minimum_steps = {"easy": 2, "medium": 3, "pro": 4}
    precedence_groups = {
        "dodawanie": 1,
        "odejmowanie": 1,
        "mnożenie": 2,
        "dzielenie": 2,
        "potęgowanie": 3,
    }

    for difficulty, minimum in minimum_steps.items():
        for _ in range(10):
            quiz = build_quiz_from_chapter(CHAPTER_DIR, difficulty)
            assert len(quiz.questions) == TARGET_QUESTION_COUNT
            assert len({question.operation_order_expression for question in quiz.questions}) == TARGET_QUESTION_COUNT
            leftmost_first_steps = 0

            for question in quiz.questions:
                assert question.selection_type == "operation_order"
                assert question.operation_order_difficulty == difficulty
                assert question.operation_order_expression
                if difficulty == "pro":
                    assert "(" in question.operation_order_expression
                assert len(question.operation_order_steps) >= minimum
                assert question.operation_order_steps[0].expression == question.operation_order_expression
                if not question.operation_order_steps[0].focus_prefix.strip():
                    leftmost_first_steps += 1
                first_step_groups = {
                    precedence_groups[choice.text.split(":", 1)[0]]
                    for choice in question.operation_order_steps[0].choices
                }
                assert len(first_step_groups) >= 2
                assert question.operation_order_steps[-1].reduced_expression == str(
                    question.operation_order_result
                )
                for step in question.operation_order_steps:
                    assert re.search(r"\b\d+\s*×\s*(\d+)\s*:\s*\1(?!\d)", step.expression) is None
                    assert re.search(r"\b\d+\s*:\s*(\d+)\s*×\s*\1(?!\d)", step.expression) is None
                    assert step.focus_prefix + step.focus + step.focus_suffix == step.expression
                    assert any(
                        choice.id == step.correct_choice_id
                        for choice in step.choices
                    )
                    assert step.expected_result >= 0
                    if step.focus.endswith("²"):
                        assert step.expected_result <= 100
                    if step.focus.endswith("³"):
                        assert step.expected_result in {8, 27}
                    if step.focus.endswith("⁴"):
                        assert step.expected_result == 16

            assert leftmost_first_steps <= (3 if difficulty == "easy" else 0)


def test_chapter_exposes_all_supported_difficulty_levels() -> None:
    quiz = build_quiz_from_chapter(CHAPTER_DIR)

    assert quiz.difficulty_levels == ["easy", "medium", "pro"]


def test_validator_rejects_unknown_operation_family() -> None:
    result = ValidationResult()

    validate_operation_order_config({"family": "unknown"}, result, "question")

    assert any("operation_order_config.family" in error for error in result.errors)
