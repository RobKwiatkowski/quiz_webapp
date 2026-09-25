import { useMemo, useState, type CSSProperties } from "react";
import type { QuizQuestion } from "../../api/quiz-api";
import type { QuizFeedback } from "./quiz-session";
import { DigitInputRow, StaticDigitRow } from "./WrittenCalculationDigits";

interface Props {
  question: QuizQuestion;
  disabled: boolean;
  onComplete: (feedback: QuizFeedback) => void;
}

export function WrittenMultiplicationQuestion({ question, disabled, onComplete }: Props) {
  const multiplicand = question.multiplicand;
  const multiplier = question.multiplier;
  const multiplierDigits = useMemo(
    () => String(multiplier ?? "").split("").reverse().map(Number),
    [multiplier],
  );
  const partialProducts = useMemo(
    () => multiplierDigits.map((digit) => String((multiplicand ?? 0) * digit)),
    [multiplicand, multiplierDigits],
  );
  const expectedResult = String((multiplicand ?? 0) * (multiplier ?? 0));
  const [scratch, setScratch] = useState<string[]>(() =>
    Array.from({ length: String(multiplicand ?? "").length }, () => ""),
  );
  const [partialAnswers, setPartialAnswers] = useState<string[][]>(() =>
    partialProducts.map((value) => Array.from({ length: value.length }, () => "")),
  );
  const [resultAnswer, setResultAnswer] = useState<string[]>(() =>
    Array.from({ length: expectedResult.length }, () => ""),
  );
  const [message, setMessage] = useState("");
  const [checked, setChecked] = useState(false);

  if (multiplicand == null || multiplier == null) {
    return <p className="subject-status subject-status-error">Nie udało się wygenerować działania.</p>;
  }

  const check = () => {
    const everyPartialDigitEntered = partialAnswers.every((row) => row.every(Boolean));
    if (!everyPartialDigitEntered || !resultAnswer.every(Boolean)) {
      setMessage("Uzupełnij wszystkie oceniane pola.");
      return;
    }

    const partialsCorrect = partialAnswers.every(
      (row, index) => row.join("") === partialProducts[index],
    );
    const resultCorrect = resultAnswer.join("") === expectedResult;
    const isCorrect = partialsCorrect && resultCorrect;
    setChecked(true);
    setMessage("");
    onComplete({
      isCorrect,
      explanation: question.explanation ?? `${multiplicand} × ${multiplier} = ${expectedResult}.`,
      earnedPoints: isCorrect ? 1 : 0,
      maximumPoints: 1,
    });
  };

  return (
    <div className="written-multiplication">
      <p className="written-multiplication-instruction">Wpisz po jednej cyfrze w każdym polu.</p>
      <div className="written-multiplication-sheet">
        <div className="multiplication-scratch-block">
          <span>Brudnopis (nie jest oceniany)</span>
          <DigitInputRow
            ariaLabel="Brudnopis"
            disabled={disabled}
            values={scratch}
            onChange={setScratch}
          />
        </div>

        <div className="multiplication-number multiplicand-number">
          <StaticDigitRow value={String(multiplicand)} />
        </div>
        <div className="multiplication-number multiplier-number">
          <span aria-hidden="true">×</span>
          <StaticDigitRow value={String(multiplier)} />
        </div>
        <div className="multiplication-rule" />

        <div className="multiplication-partials" aria-label="Wyniki cząstkowe">
          {partialProducts.map((expected, rowIndex) => (
            <div
              className="multiplication-partial-row"
              key={`${question.id}-partial-${rowIndex}`}
              style={{ "--place-offset": rowIndex } as CSSProperties}
            >
              <DigitInputRow
                ariaLabel={`Wynik cząstkowy ${rowIndex + 1}`}
                disabled={disabled}
                expected={checked ? expected : undefined}
                values={partialAnswers[rowIndex]}
                onChange={(values) => {
                  setMessage("");
                  setPartialAnswers((current) => current.map((row, index) => index === rowIndex ? values : row));
                }}
              />
            </div>
          ))}
          <span className="multiplication-row-label">wyniki cząstkowe</span>
        </div>

        <div className="multiplication-rule" />
        <div className="multiplication-result-row">
          <DigitInputRow
            ariaLabel="Wynik końcowy"
            disabled={disabled}
            expected={checked ? expectedResult : undefined}
            values={resultAnswer}
            onChange={(values) => { setMessage(""); setResultAnswer(values); }}
          />
          <span className="multiplication-row-label">wynik</span>
        </div>
      </div>

      {message && <p className="feedback warning-feedback">{message}</p>}
      {!disabled && <button className="quiz-action" onClick={check} type="button">Sprawdź</button>}
    </div>
  );
}
