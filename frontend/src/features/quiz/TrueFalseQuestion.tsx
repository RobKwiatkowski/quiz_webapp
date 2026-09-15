import { useState } from "react";
import type { QuizQuestion } from "../../api/quiz-api";
import type { QuizFeedback } from "./quiz-session";

interface Props {
  question: QuizQuestion;
  disabled: boolean;
  onComplete: (feedback: QuizFeedback) => void;
}

export function TrueFalseQuestion({ question, disabled, onComplete }: Props) {
  const [answers, setAnswers] = useState<Array<boolean | null>>(
    () => question.answers.map(() => null),
  );
  const [message, setMessage] = useState("");

  const selectAnswer = (index: number, value: boolean) => {
    if (disabled) return;
    setMessage("");
    setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? value : answer));
  };

  const check = () => {
    if (answers.some((answer) => answer === null)) {
      setMessage("Oceń każde zdanie.");
      return;
    }

    const isCorrect = question.answers.every((statement, index) => answers[index] === statement.is_correct);
    onComplete({
      isCorrect,
      explanation: question.explanation ?? "",
      earnedPoints: isCorrect ? 1 : 0,
      maximumPoints: 1,
    });
  };

  return (
    <div className="true-false-question">
      <div className="true-false-table" role="group" aria-label="Oceń prawdziwość zdań">
        <div className="true-false-header" aria-hidden="true">
          <span>Zdanie</span>
          <span>P</span>
          <span>F</span>
        </div>
        {question.answers.map((statement, index) => {
          const selectedAnswer = answers[index];
          const isCorrect = disabled && selectedAnswer === statement.is_correct;
          const isIncorrect = disabled && selectedAnswer !== null && selectedAnswer !== statement.is_correct;

          return (
            <div className={`true-false-row ${isCorrect ? "is-correct" : ""} ${isIncorrect ? "is-incorrect" : ""}`} key={`${question.id}-${index}`}>
              <span className="true-false-statement"><span className="true-false-number">{index + 1}.</span>{statement.text}</span>
              <button
                aria-label={`Zdanie ${index + 1}: prawda`}
                aria-pressed={selectedAnswer === true}
                className={`true-false-choice ${selectedAnswer === true ? "selected" : ""}`}
                disabled={disabled}
                onClick={() => selectAnswer(index, true)}
                type="button"
              >
                P
              </button>
              <button
                aria-label={`Zdanie ${index + 1}: fałsz`}
                aria-pressed={selectedAnswer === false}
                className={`true-false-choice ${selectedAnswer === false ? "selected" : ""}`}
                disabled={disabled}
                onClick={() => selectAnswer(index, false)}
                type="button"
              >
                F
              </button>
            </div>
          );
        })}
      </div>
      {message && <p className="feedback warning-feedback">{message}</p>}
      {!disabled && <button id="check-button" onClick={check} type="button">Sprawdź</button>}
    </div>
  );
}
