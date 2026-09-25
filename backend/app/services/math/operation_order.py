"""Generate step-by-step order-of-operations questions.

The generator works with a small expression tree instead of evaluating text.
This keeps the arithmetic rules explicit, testable, and safe.
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass, replace
from typing import Literal

from app.models.quiz import OperationOrderChoice, OperationOrderStep, Question

Difficulty = Literal["easy", "medium", "pro"]
Operator = Literal[
    "add",
    "subtract",
    "multiply",
    "divide",
    "square",
    "cube",
    "fourth_power",
]

POWER_EXPONENTS: dict[Operator, int] = {
    "square": 2,
    "cube": 3,
    "fourth_power": 4,
}

OPERATOR_SYMBOLS: dict[Operator, str] = {
    "add": "+",
    "subtract": "−",
    "multiply": "×",
    "divide": ":",
    "square": "²",
    "cube": "³",
    "fourth_power": "⁴",
}
OPERATOR_LABELS: dict[Operator, str] = {
    "add": "dodawanie",
    "subtract": "odejmowanie",
    "multiply": "mnożenie",
    "divide": "dzielenie",
    "square": "potęgowanie",
    "cube": "potęgowanie",
    "fourth_power": "potęgowanie",
}
PRECEDENCE: dict[Operator, int] = {
    "add": 1,
    "subtract": 1,
    "multiply": 2,
    "divide": 2,
    "square": 3,
    "cube": 3,
    "fourth_power": 3,
}
TRIVIAL_INVERSE_PATTERNS = (
    re.compile(r"\b\d+\s*×\s*(\d+)\s*:\s*\1(?!\d)"),
    re.compile(r"\b\d+\s*:\s*(\d+)\s*×\s*\1(?!\d)"),
)


@dataclass(frozen=True)
class NumberNode:
    """Integer leaf in a generated expression tree."""

    value: int


@dataclass(frozen=True)
class OperationNode:
    """One unary or binary operation in a generated expression tree."""

    id: str
    operator: Operator
    left: Node
    right: Node | None = None
    grouped: bool = False


Node = NumberNode | OperationNode


class ExpressionBuilder:
    """Creates nodes with stable operation identifiers for one expression."""

    def __init__(self) -> None:
        self._next_id = 1

    @staticmethod
    def number(value: int) -> NumberNode:
        return NumberNode(value)

    def operation(
        self,
        operator: Operator,
        left: Node,
        right: Node | None = None,
        *,
        grouped: bool = False,
    ) -> OperationNode:
        node = OperationNode(
            id=f"operation-{self._next_id}",
            operator=operator,
            left=left,
            right=right,
            grouped=grouped,
        )
        self._next_id += 1
        return node


def evaluate_expression(node: Node) -> int:
    """Evaluates a generated expression tree using integer arithmetic."""
    if isinstance(node, NumberNode):
        return node.value

    left = evaluate_expression(node.left)
    if node.operator in POWER_EXPONENTS:
        return left ** POWER_EXPONENTS[node.operator]

    if node.right is None:
        raise ValueError(f"{node.operator} requires a right operand")
    right = evaluate_expression(node.right)

    if node.operator == "add":
        return left + right
    if node.operator == "subtract":
        return left - right
    if node.operator == "multiply":
        return left * right
    if right == 0 or left % right != 0:
        raise ValueError("generated division must have a non-zero divisor and integer result")
    return left // right


def render_expression(node: Node, target_id: str | None = None) -> str:
    """Renders an expression with Polish school arithmetic symbols."""
    return _render_expression(node, target_id=target_id)


def _render_expression(
    node: Node,
    *,
    parent_precedence: int = 0,
    parent_operator: Operator | None = None,
    side: Literal["left", "right"] | None = None,
    target_id: str | None = None,
) -> str:
    if isinstance(node, NumberNode):
        return str(node.value)

    own_precedence = PRECEDENCE[node.operator]
    if node.operator in POWER_EXPONENTS:
        text = (
            _render_expression(
                node.left,
                parent_precedence=own_precedence,
                parent_operator=node.operator,
                side="left",
                target_id=target_id,
            )
            + OPERATOR_SYMBOLS[node.operator]
        )
    else:
        if node.right is None:
            raise ValueError(f"{node.operator} requires a right operand")
        left = _render_expression(
            node.left,
            parent_precedence=own_precedence,
            parent_operator=node.operator,
            side="left",
            target_id=target_id,
        )
        right = _render_expression(
            node.right,
            parent_precedence=own_precedence,
            parent_operator=node.operator,
            side="right",
            target_id=target_id,
        )
        text = f"{left} {OPERATOR_SYMBOLS[node.operator]} {right}"

    needs_parentheses = node.grouped or own_precedence < parent_precedence
    if (
        side == "right"
        and own_precedence == parent_precedence
        and parent_operator in {"subtract", "divide"}
    ):
        needs_parentheses = True
    if needs_parentheses:
        text = f"({text})"
    if node.id == target_id:
        text = f"\u0002{text}\u0003"
    return text


def _find_next_operation(node: Node) -> OperationNode:
    """Returns the left-most deepest operation in the canonical solution."""
    if isinstance(node, NumberNode):
        raise ValueError("number has no operation to resolve")
    if isinstance(node.left, OperationNode):
        return _find_next_operation(node.left)
    if isinstance(node.right, OperationNode):
        return _find_next_operation(node.right)
    return node


def _collect_operations(node: Node) -> list[OperationNode]:
    if isinstance(node, NumberNode):
        return []
    operations = [node]
    operations.extend(_collect_operations(node.left))
    if node.right is not None:
        operations.extend(_collect_operations(node.right))
    return operations


def _render_choice_operand(
    node: Node,
    *,
    edge: Literal["left", "right"],
    parent_operator: Operator,
    side: Literal["left", "right"],
) -> str:
    """Renders the visible operand directly next to an operator choice."""
    if isinstance(node, NumberNode):
        return str(node.value)

    needs_parentheses = (
        node.grouped
        or PRECEDENCE[node.operator] < PRECEDENCE[parent_operator]
        or (
            side == "right"
            and PRECEDENCE[node.operator] == PRECEDENCE[parent_operator]
            and parent_operator in {"subtract", "divide"}
        )
    )
    if needs_parentheses or node.operator in POWER_EXPONENTS:
        return _render_expression(
            node,
            parent_precedence=PRECEDENCE[parent_operator],
            parent_operator=parent_operator,
            side=side,
        )

    adjacent_child = node.left if edge == "left" else node.right
    if adjacent_child is None:
        return render_expression(node)
    return _render_choice_operand(
        adjacent_child,
        edge=edge,
        parent_operator=node.operator,
        side="left" if edge == "left" else "right",
    )


def _render_choice_fragment(operation: OperationNode) -> str:
    """Renders only the local fragment that identifies an operation sign."""
    if operation.operator in POWER_EXPONENTS:
        return render_expression(operation)
    if operation.right is None:
        raise ValueError(f"{operation.operator} requires a right operand")

    left = _render_choice_operand(
        operation.left,
        edge="right",
        parent_operator=operation.operator,
        side="left",
    )
    right = _render_choice_operand(
        operation.right,
        edge="left",
        parent_operator=operation.operator,
        side="right",
    )
    return f"{left} {OPERATOR_SYMBOLS[operation.operator]} {right}"


def _replace_operation(node: Node, operation_id: str, value: int) -> Node:
    if isinstance(node, NumberNode):
        return node
    if node.id == operation_id:
        return NumberNode(value)
    return replace(
        node,
        left=_replace_operation(node.left, operation_id, value),
        right=(
            _replace_operation(node.right, operation_id, value)
            if node.right is not None
            else None
        ),
    )


def _rule_for_step(
    target: OperationNode,
    family: str,
    operation_count: int,
) -> str:
    if target.grouped:
        return "Najpierw wykonujemy działanie w nawiasie."
    if target.operator in POWER_EXPONENTS:
        return "Potęgowanie wykonujemy przed pozostałymi działaniami."
    if family == "left_to_right" and operation_count > 1:
        if target.operator in {"multiply", "divide"}:
            return "Mnożenie i dzielenie wykonujemy od lewej do prawej."
        return "Dodawanie i odejmowanie wykonujemy od lewej do prawej."
    if target.operator in {"multiply", "divide"} and operation_count > 1:
        return "Mnożenie i dzielenie wykonujemy przed dodawaniem i odejmowaniem."
    if operation_count == 1:
        return "To ostatnie działanie w tym wyrażeniu."
    return "Wykonaj teraz wskazane działanie."


def build_solution_steps(root: Node, family: str) -> tuple[list[OperationOrderStep], int]:
    """Builds every canonical reduction from the initial expression to its result."""
    current = root
    steps: list[OperationOrderStep] = []

    while isinstance(current, OperationNode):
        operations = _collect_operations(current)
        target = _find_next_operation(current)
        expected_result = evaluate_expression(target)
        marked_expression = render_expression(current, target.id)
        if "\u0002" not in marked_expression or "\u0003" not in marked_expression:
            raise ValueError("target operation marker was not rendered")
        prefix, marked_tail = marked_expression.split("\u0002", 1)
        focus, suffix = marked_tail.split("\u0003", 1)
        reduced = _replace_operation(current, target.id, expected_result)
        choices = [
            OperationOrderChoice(
                id=operation.id,
                text=(
                    f"{OPERATOR_LABELS[operation.operator]}: "
                    f"{_render_choice_fragment(operation)}"
                ),
            )
            for operation in operations
        ]
        steps.append(
            OperationOrderStep(
                expression=render_expression(current),
                choices=choices,
                correct_choice_id=target.id,
                focus_prefix=prefix,
                focus=focus,
                focus_suffix=suffix,
                expected_result=expected_result,
                reduced_expression=render_expression(reduced),
                rule=_rule_for_step(target, family, len(operations)),
            )
        )
        current = reduced

    return steps, current.value


def _operand_range(difficulty: Difficulty) -> tuple[int, int]:
    if difficulty == "easy":
        return 2, 9
    if difficulty == "medium":
        return 2, 12
    return 2, 15


def _random_operand(difficulty: Difficulty) -> int:
    minimum, maximum = _operand_range(difficulty)
    return random.randint(minimum, maximum)


def _random_power_spec(difficulty: Difficulty) -> tuple[Operator, int]:
    """Chooses a supported base/exponent pair for a generated power."""
    maximum_square_base = min(10, _operand_range(difficulty)[1])
    return random.choice(
        [
            ("square", random.randint(2, maximum_square_base)),
            ("square", 3),
            ("cube", 2),
            ("cube", 3),
            ("fourth_power", 2),
        ]
    )


def _random_power_term(
    builder: ExpressionBuilder,
    difficulty: Difficulty,
) -> tuple[OperationNode, int]:
    operator, base = _random_power_spec(difficulty)
    return (
        builder.operation(operator, builder.number(base)),
        base ** POWER_EXPONENTS[operator],
    )


def _precedence_expression(difficulty: Difficulty) -> Node:
    builder = ExpressionBuilder()
    n = builder.number
    op = builder.operation

    if difficulty == "easy":
        pattern = random.randrange(3)
        a, b, c = (_random_operand(difficulty) for _ in range(3))
        if pattern == 0:
            return op("add", n(a), op("multiply", n(b), n(c)))
        if pattern == 1:
            product = b * c
            return op("subtract", op("multiply", n(b), n(c)), n(min(a, product - 1)))
        divisor = b
        quotient = c
        return op("add", op("divide", n(divisor * quotient), n(divisor)), n(a))

    if difficulty == "medium":
        pattern = random.randrange(3)
        a, b, c = (_random_operand(difficulty) for _ in range(3))
        if pattern == 0:
            return op("add", n(a), op("multiply", n(b), op("square", n(c))))
        if pattern == 1:
            divisor = max(2, b)
            product = c * a
            return op(
                "subtract",
                op("multiply", op("divide", n(divisor * c), n(divisor)), n(a)),
                n(min(b, product - 1)),
            )
        divisor = max(2, b)
        return op(
            "add",
            op("divide", op("multiply", n(divisor * c), n(a)), n(divisor)),
            n(b),
        )

    a, b, c, d = (_random_operand(difficulty) for _ in range(4))
    if random.choice((True, False)):
        squared_sum = op("square", op("add", n(a), n(b), grouped=True))
        total = (a + b) ** 2 * c
        return op("subtract", op("multiply", squared_sum, n(c)), n(min(d, total - 1)))
    divisor = min(c, 10)
    multiplier = b if b != divisor else (b % 15) + 2
    squared = op("square", n(divisor))
    return op(
        "add",
        op("divide", op("multiply", squared, n(multiplier)), n(divisor)),
        n(a),
    )


def _parentheses_expression(difficulty: Difficulty) -> Node:
    builder = ExpressionBuilder()
    n = builder.number
    op = builder.operation
    a, b, c, d, e = (_random_operand(difficulty) for _ in range(5))

    if difficulty == "easy":
        if random.choice((True, False)):
            grouped = op("add", n(a), n(b), grouped=True)
        else:
            grouped = op("subtract", n(a + b), n(b), grouped=True)
        return op("multiply", grouped, n(c))

    if difficulty == "medium":
        if random.choice((True, False)):
            grouped = op("subtract", n(a + b), n(b), grouped=True)
            return op("add", op("multiply", grouped, n(c)), n(d))
        grouped = op("add", n(a), n(b), grouped=True)
        total = (a + b) ** 2
        return op("subtract", op("square", grouped), n(min(d, total - 1)))

    a = random.randint(2, 4)
    b = random.randint(2, 10)
    c = random.randint(2, max(2, 8 // a))
    d = random.randint(2, 10 - a * c)
    e = _random_operand(difficulty)
    inner = op("subtract", n(a + b), n(b), grouped=True)
    multiplied = op("multiply", inner, n(c))
    summed = op("add", multiplied, n(d), grouped=True)
    return op("add", op("square", summed), n(e))


def _powers_expression(difficulty: Difficulty) -> Node:
    builder = ExpressionBuilder()
    n = builder.number
    op = builder.operation
    a, b, c, d = (_random_operand(difficulty) for _ in range(4))

    if difficulty == "easy":
        power, power_value = _random_power_term(builder, difficulty)
        if random.choice((True, False)):
            return op("add", n(a), power)
        return op("subtract", power, n(min(a, power_value - 1)))

    if difficulty == "medium":
        if random.choice((True, False)):
            power, _ = _random_power_term(builder, difficulty)
            return op("add", op("multiply", power, n(c)), n(a))
        grouped = op("add", n(a), n(b), grouped=True)
        total = (a + b) ** 2
        return op("subtract", op("square", grouped), n(min(c, total - 1)))

    power_operator, power_base = _random_power_spec(difficulty)
    a = random.randint(2, 5)
    minimum_b = max(2, (power_base + 2 + a - 1) // a)
    b = random.randint(minimum_b, max(5, minimum_b))
    inner_value = a * b
    multiplied = op("multiply", n(a), n(b))
    subtracted = op(
        "subtract",
        multiplied,
        n(inner_value - power_base),
        grouped=True,
    )
    return op("add", op(power_operator, subtracted), n(d))


def _left_to_right_expression(difficulty: Difficulty) -> Node:
    builder = ExpressionBuilder()
    n = builder.number
    op = builder.operation

    if difficulty == "easy" and random.choice((True, False)):
        divisor = _random_operand(difficulty)
        quotient = _random_operand(difficulty)
        factor = _random_operand(difficulty)
        product = op("multiply", op("divide", n(divisor * quotient), n(divisor)), n(factor))
        return op("add", product, n(_random_operand(difficulty)))

    operation_count = {"easy": 2, "medium": 4, "pro": 5}[difficulty]
    if random.choice((True, False)):
        root: Node = op(
            "multiply",
            n(random.randint(2, 5)),
            n(random.randint(2, 5)),
        )
        for index in range(operation_count):
            operand = random.randint(2, 5)
            if index % 2 == 0:
                root = op("add", root, n(operand))
            else:
                root = op("subtract", root, n(operand))
        return root

    divisor = _random_operand(difficulty)
    quotient = _random_operand(difficulty)
    root = op("divide", n(divisor * quotient), n(divisor))
    remaining = operation_count - 1
    for index in range(remaining):
        factor = random.randint(2, 5)
        if index % 2 == 0:
            root = op("multiply", root, n(factor))
        else:
            root = op("divide", root, n(factor))
    return op("add", root, n(_random_operand(difficulty)))


def _generate_candidate(family: str, difficulty: Difficulty) -> Node:
    generators = {
        "precedence": _precedence_expression,
        "parentheses": _parentheses_expression,
        "powers": _powers_expression,
        "left_to_right": _left_to_right_expression,
    }
    try:
        generator = generators[family]
    except KeyError as error:
        raise ValueError(f"unsupported operation-order family: {family}") from error
    candidate = generator(difficulty)
    if difficulty == "pro":
        return _move_expression_behind_leading_term(candidate, difficulty)
    if _first_operation_is_leftmost(candidate) and not (
        difficulty == "easy" and family == "parentheses"
    ):
        return _move_expression_behind_leading_term(candidate, difficulty)
    return candidate


def _first_operation_is_leftmost(root: Node) -> bool:
    if isinstance(root, NumberNode):
        return False
    target = _find_next_operation(root)
    marked_expression = render_expression(root, target.id)
    prefix = marked_expression.split("\u0002", 1)[0]
    return not prefix.strip()


def _move_expression_behind_leading_term(root: Node, difficulty: Difficulty) -> Node:
    """Places a grouped expression after a simple leading addend."""
    if isinstance(root, NumberNode):
        return root
    return OperationNode(
        id="operation-leading-wrapper",
        operator="add",
        left=NumberNode(_random_operand(difficulty)),
        right=replace(root, grouped=True),
    )


def _candidate_is_suitable(
    root: Node,
    steps: list[OperationOrderStep],
    final_result: int,
    difficulty: Difficulty,
) -> bool:
    expected_steps = {"easy": 2, "medium": 3, "pro": 4}[difficulty]
    maximum_result = {"easy": 100, "medium": 500, "pro": 2500}[difficulty]
    if len(steps) < expected_steps:
        return False
    if len({PRECEDENCE[operation.operator] for operation in _collect_operations(root)}) < 2:
        return False
    if not _powers_are_allowed(root):
        return False
    if _contains_trivial_inverse_operations(steps):
        return False
    values = [step.expected_result for step in steps]
    return all(0 <= value <= maximum_result for value in values) and 0 <= final_result <= maximum_result


def _powers_are_allowed(node: Node) -> bool:
    """Checks every generated base/exponent pair against the learning scope."""
    if isinstance(node, NumberNode):
        return True
    if node.operator in POWER_EXPONENTS:
        base = evaluate_expression(node.left)
        if node.operator == "square" and not 0 <= base <= 10:
            return False
        if node.operator == "cube" and base not in {2, 3}:
            return False
        if node.operator == "fourth_power" and base != 2:
            return False
    return _powers_are_allowed(node.left) and (
        node.right is None or _powers_are_allowed(node.right)
    )


def _contains_trivial_inverse_operations(steps: list[OperationOrderStep]) -> bool:
    """Detects adjacent multiplication/division that cancel the same factor."""
    expressions = [
        expression
        for step in steps
        for expression in (step.expression, step.reduced_expression)
    ]
    return any(
        pattern.search(expression)
        for expression in expressions
        for pattern in TRIVIAL_INVERSE_PATTERNS
    )


def resolve_operation_order_question(
    question: Question,
    used_expressions: set[str],
    difficulty: Difficulty,
) -> Question:
    """Resolves one operation-order template into a concrete guided exercise."""
    if question.selection_type != "operation_order" or question.operation_order_config is None:
        return question

    family = question.operation_order_config.family
    for _ in range(1000):
        root = _generate_candidate(family, difficulty)
        expression = render_expression(root)
        try:
            steps, final_result = build_solution_steps(root, family)
        except ValueError:
            continue
        if expression in used_expressions:
            continue
        if not _candidate_is_suitable(root, steps, final_result, difficulty):
            continue

        used_expressions.add(expression)
        solution = " → ".join([expression, *(step.reduced_expression for step in steps)])
        return question.model_copy(
            update={
                "operation_order_difficulty": difficulty,
                "operation_order_expression": expression,
                "operation_order_steps": steps,
                "operation_order_result": final_result,
                "explanation": f"Poprawna kolejność: {solution}.",
            }
        )

    raise ValueError(
        f"operation-order settings cannot generate a unique {difficulty} question for {family}"
    )
