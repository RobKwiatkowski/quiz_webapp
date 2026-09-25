import { useEffect, useRef, useState, type FormEvent } from "react";
import type { QuizQuestion } from "../../api/quiz-api";
import type { QuizFeedback } from "./quiz-session";

interface Props {
  question: QuizQuestion;
  disabled: boolean;
  onComplete: (feedback: QuizFeedback) => void;
}

export function TimedMultiplicationQuestion({ question, disabled, onComplete }: Props) {
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const timeLimitSeconds = question.timed_multiplication_config?.time_limit_seconds ?? 5;
  const [remainingMs, setRemainingMs] = useState(timeLimitSeconds * 1000);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const multiplicand = question.multiplicand;
  const multiplier = question.multiplier;
  const correctResult = multiplicand != null && multiplier != null
    ? multiplicand * multiplier
    : null;

  useEffect(() => {
    if (disabled || correctResult == null) return;

    const deadline = performance.now() + timeLimitSeconds * 1000;
    const timer = window.setInterval(() => {
      const nextRemainingMs = Math.max(0, deadline - performance.now());
      setRemainingMs(nextRemainingMs);

      if (nextRemainingMs === 0 && !completedRef.current) {
        completedRef.current = true;
        window.clearInterval(timer);
        onCompleteRef.current({
          isCorrect: false,
          explanation: `Czas minął. ${question.explanation ?? `${multiplicand} × ${multiplier} = ${correctResult}.`}`,
          earnedPoints: 0,
          maximumPoints: 1,
        });
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, [correctResult, disabled, multiplicand, multiplier, question.explanation, question.id, timeLimitSeconds]);

  if (multiplicand == null || multiplier == null || correctResult == null) {
    return <p className="subject-status subject-status-error">Nie udało się wygenerować działania.</p>;
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (disabled || completedRef.current) return;
    if (!answer.trim()) {
      setMessage("Wpisz wynik.");
      return;
    }

    completedRef.current = true;
    const isCorrect = Number(answer) === correctResult;
    onComplete({
      isCorrect,
      explanation: question.explanation ?? `${multiplicand} × ${multiplier} = ${correctResult}.`,
      earnedPoints: isCorrect ? 1 : 0,
      maximumPoints: 1,
    });
  };

  const remainingPercent = Math.max(0, Math.min(100, (remainingMs / (timeLimitSeconds * 1000)) * 100));
  const displayedSeconds = Math.ceil(remainingMs / 1000);

  return (
    <form className="timed-multiplication" onSubmit={submit}>
      <div className="timed-multiplication-timer" aria-live="polite">
        <span>Pozostały czas</span>
        <strong>{displayedSeconds} s</strong>
      </div>
      <div className="timed-multiplication-track" aria-hidden="true">
        <span style={{ width: `${remainingPercent}%` }} />
      </div>
      <div className="timed-multiplication-expression">
        <span>{multiplicand}</span>
        <span aria-hidden="true">×</span>
        <span>{multiplier}</span>
        <span aria-hidden="true">=</span>
        <input
          aria-label="Wynik mnożenia"
          autoFocus
          disabled={disabled}
          inputMode="numeric"
          onChange={(event) => { setAnswer(event.target.value.replace(/\D/g, "")); setMessage(""); }}
          pattern="[0-9]*"
          value={answer}
        />
      </div>
      {message && <p className="feedback warning-feedback">{message}</p>}
      {!disabled && <button className="quiz-action" type="submit">Sprawdź</button>}
    </form>
  );
}
