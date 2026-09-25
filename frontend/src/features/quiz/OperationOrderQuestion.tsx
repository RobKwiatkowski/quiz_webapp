import { useState } from "react";
import type { QuizQuestion } from "../../api/quiz-api";
import type { QuizFeedback } from "./quiz-session";

interface Props {
  question: QuizQuestion;
  disabled: boolean;
  onComplete: (feedback: QuizFeedback) => void;
}

export function OperationOrderQuestion({ question, disabled, onComplete }: Props) {
  const steps = question.operation_order_steps;
  const difficulty = question.operation_order_difficulty ?? "easy";
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);

  if (!steps.length || !question.operation_order_expression) {
    return <p className="subject-status subject-status-error">Nie udało się wygenerować działania.</p>;
  }

  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const guided = difficulty === "easy";
  const automaticallySelected = guided || step.choices.length === 1;
  const operationSelected = automaticallySelected || selectedChoiceId === step.correct_choice_id;
  const visibleSteps = steps.slice(0, stepIndex + 1);
  const expressionLength = question.operation_order_expression.length;
  const expressionSizeClass = expressionLength >= 30
    ? "operation-order-stage-very-compact"
    : expressionLength >= 22
      ? "operation-order-stage-compact"
      : "";

  const failProStep = (reason: string, hint: string) => {
    const solution = question.explanation?.trim();
    onComplete({
      isCorrect: false,
      explanation: `${reason} Wskazówka: ${hint}${solution ? ` ${solution}` : ""}`,
      earnedPoints: 0,
      maximumPoints: 1,
    });
  };

  const selectOperation = (choiceId: string) => {
    if (disabled) return;
    if (choiceId !== step.correct_choice_id) {
      if (difficulty === "pro") {
        failProStep("Wybrane działanie jest niepoprawne.", step.rule);
        return;
      }
      setSelectedChoiceId(null);
      setMessage(`To nie jest następne działanie. ${step.rule}`);
      return;
    }
    setSelectedChoiceId(choiceId);
    setMessage("");
  };

  const checkResult = () => {
    if (!answer.trim()) {
      setMessage("Wpisz wynik zaznaczonego działania.");
      return;
    }

    if (Number(answer) !== step.expected_result) {
      if (difficulty === "pro") {
        failProStep("Wynik tego kroku jest niepoprawny.", `Sprawdź obliczenie ${step.focus}.`);
        return;
      }
      setMessage(`Ten wynik nie jest poprawny. ${step.rule}`);
      return;
    }

    const isLastStep = stepIndex === steps.length - 1;
    if (isLastStep) {
      setCompleted(true);
      onComplete({
        isCorrect: true,
        explanation: question.explanation ?? `Wynik działania to ${step.expected_result}.`,
        earnedPoints: 1,
        maximumPoints: 1,
      });
      setMessage("Gotowe — całe działanie zostało obliczone.");
      return;
    }

    setStepIndex((current) => current + 1);
    setSelectedChoiceId(null);
    setAnswer("");
    setMessage("");
  };

  return (
    <div className="operation-order-question">
      <div className={`operation-order-stage ${expressionSizeClass}`.trim()}>
        <span className="operation-order-step-label">
          {completed ? "Pełne rozwiązanie" : `Krok ${stepIndex + 1} z ${steps.length}`}
        </span>
        <div
          aria-label="Przebieg obliczeń"
          aria-live="polite"
          className="operation-order-history"
          role="list"
        >
          {visibleSteps.map((visibleStep, visibleIndex) => {
            const isCurrentStep = visibleIndex === stepIndex && !completed;
            const shouldHighlight = isCurrentStep && operationSelected;

            return (
              <div className="operation-order-history-row" key={`${visibleIndex}-${visibleStep.expression}`} role="listitem">
                <span aria-hidden="true" className="operation-order-equals">
                  {visibleIndex === 0 ? "" : "="}
                </span>
                <p
                  className="operation-order-expression"
                  aria-label={`${visibleIndex === 0 ? "Działanie" : `Krok ${visibleIndex}`}: ${visibleStep.expression}`}
                >
                  {shouldHighlight ? (
                    <>
                      <span>{visibleStep.focus_prefix}</span>
                      <mark>{visibleStep.focus}</mark>
                      <span>{visibleStep.focus_suffix}</span>
                    </>
                  ) : visibleStep.expression}
                </p>
              </div>
            );
          })}
          {completed && (
            <div className="operation-order-history-row operation-order-final-row" role="listitem">
              <span aria-hidden="true" className="operation-order-equals">=</span>
              <p className="operation-order-expression" aria-label={`Wynik: ${question.operation_order_result ?? step.expected_result}`}>
                {question.operation_order_result ?? step.expected_result}
              </p>
            </div>
          )}
        </div>
      </div>

      {guided ? (
        <p className="operation-order-rule">{step.rule}</p>
      ) : !operationSelected ? (
        <div className="operation-order-choice-panel">
          <p>Wybierz działanie, które należy wykonać teraz.</p>
          <div className="operation-order-choices">
            {step.choices.map((choice) => (
              <button
                disabled={disabled}
                key={choice.id}
                onClick={() => selectOperation(choice.id)}
                type="button"
              >
                {choice.text}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="operation-order-rule operation-order-rule-confirmed">Dobry wybór. Oblicz zaznaczony fragment.</p>
      )}

      {operationSelected && !disabled && (
        <div className="operation-order-answer">
          <label>
            Wynik zaznaczonego działania
            <input
              autoFocus
              inputMode="numeric"
              onChange={(event) => { setAnswer(event.target.value.replace(/[^0-9-]/g, "")); setMessage(""); }}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); checkResult(); } }}
              pattern="-?[0-9]*"
              value={answer}
            />
          </label>
          <button className="quiz-action" onClick={checkResult} type="button">Sprawdź krok</button>
        </div>
      )}

      {message && <p className={disabled ? "operation-order-complete" : "feedback warning-feedback"}>{message}</p>}
    </div>
  );
}
