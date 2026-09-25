import { useMemo, useState, type CSSProperties } from "react";
import type { QuizQuestion } from "../../api/quiz-api";
import type { QuizFeedback } from "./quiz-session";
import { DigitInputRow, StaticDigitRow } from "./WrittenCalculationDigits";

interface Props {
  question: QuizQuestion;
  disabled: boolean;
  onComplete: (feedback: QuizFeedback) => void;
}

interface DivisionStep {
  columnIndex: number;
  partialDividend: string;
  subtraction: string;
  remainder: number;
}

export function WrittenDivisionQuestion({ question, disabled, onComplete }: Props) {
  const dividend = question.dividend;
  const divisor = question.divisor;
  const quotient = question.quotient;
  const steps = useMemo(
    () => dividend != null && divisor != null ? calculateDivisionSteps(dividend, divisor) : [],
    [dividend, divisor],
  );
  const dividendDigits = String(dividend ?? "").length;
  const expectedQuotient = String(quotient ?? "");
  const [quotientAnswer, setQuotientAnswer] = useState<string[]>(() =>
    Array.from({ length: expectedQuotient.length }, () => ""),
  );
  const [partialAnswers, setPartialAnswers] = useState<string[][]>(() =>
    steps.slice(1).map((step) => Array.from({ length: step.partialDividend.length }, () => "")),
  );
  const [subtractionAnswers, setSubtractionAnswers] = useState<string[][]>(() =>
    steps.map((step) => Array.from({ length: step.subtraction.length }, () => "")),
  );
  const [intermediateZeroAnswers, setIntermediateZeroAnswers] = useState<string[][]>(() =>
    steps.slice(0, -1).map((step) => step.remainder === 0 ? [""] : []),
  );
  const expectedRemainder = String(steps.at(-1)?.remainder ?? 0);
  const [remainderAnswer, setRemainderAnswer] = useState<string[]>(() =>
    Array.from({ length: expectedRemainder.length }, () => ""),
  );
  const [checked, setChecked] = useState(false);
  const [message, setMessage] = useState("");

  if (dividend == null || divisor == null || quotient == null || steps.length === 0) {
    return <p className="subject-status subject-status-error">Nie udało się wygenerować działania.</p>;
  }

  const check = () => {
    const rows = [
      quotientAnswer,
      remainderAnswer,
      ...partialAnswers,
      ...subtractionAnswers,
      ...intermediateZeroAnswers,
    ];
    if (!rows.every((row) => row.every(Boolean))) {
      setMessage("Uzupełnij wszystkie oceniane pola.");
      return;
    }

    const quotientCorrect = quotientAnswer.join("") === expectedQuotient;
    const partialsCorrect = partialAnswers.every(
      (row, index) => row.join("") === steps[index + 1].partialDividend,
    );
    const subtractionsCorrect = subtractionAnswers.every(
      (row, index) => row.join("") === steps[index].subtraction,
    );
    const remainderCorrect = remainderAnswer.join("") === expectedRemainder;
    const intermediateZerosCorrect = intermediateZeroAnswers.every(
      (row) => row.length === 0 || row.join("") === "0",
    );
    const isCorrect = quotientCorrect
      && partialsCorrect
      && subtractionsCorrect
      && intermediateZerosCorrect
      && remainderCorrect;
    setChecked(true);
    setMessage("");
    onComplete({
      isCorrect,
      explanation: question.explanation ?? `${dividend} : ${divisor} = ${quotient}.`,
      earnedPoints: isCorrect ? 1 : 0,
      maximumPoints: 1,
    });
  };

  return (
    <div className="written-division">
      <p className="written-division-instruction">Wpisz iloraz nad kreską i uzupełnij kolejne kroki obliczeń.</p>
      <div
        className="written-division-sheet"
        style={{ "--dividend-columns": dividendDigits } as CSSProperties}
      >
        <div className="division-quotient-row">
          <DigitInputRow
            ariaLabel="Iloraz"
            disabled={disabled}
            expected={checked ? expectedQuotient : undefined}
            values={quotientAnswer}
            onChange={(values) => { setMessage(""); setQuotientAnswer(values); }}
          />
          <span>iloraz</span>
        </div>

        <div className="division-expression">
          <div className="division-dividend">
            <div className="division-result-rule" aria-hidden="true" />
            <StaticDigitRow value={String(dividend)} />
          </div>
          <span className="division-symbol" aria-hidden="true">:</span>
          <StaticDigitRow value={String(divisor)} />
        </div>

        <div className="division-work" aria-label="Kolejne kroki dzielenia pisemnego">
          {steps.map((step, stepIndex) => {
            const trailingColumns = dividendDigits - step.columnIndex - 1;
            return (
              <div className="division-step" key={`${question.id}-step-${stepIndex}`}>
                {stepIndex > 0 && (
                  <div className="division-aligned-row" style={{ "--trailing-columns": trailingColumns } as CSSProperties}>
                    <DigitInputRow
                      ariaLabel={`Liczba po sprowadzeniu w kroku ${stepIndex + 1}`}
                      disabled={disabled}
                      expected={checked ? step.partialDividend : undefined}
                      values={partialAnswers[stepIndex - 1]}
                      onChange={(values) => {
                        setMessage("");
                        setPartialAnswers((current) => current.map((row, index) => index === stepIndex - 1 ? values : row));
                      }}
                    />
                  </div>
                )}
                <div className="division-subtraction-group" style={{ "--trailing-columns": trailingColumns } as CSSProperties}>
                  <div className="division-subtraction-row">
                    <span aria-hidden="true">−</span>
                    <DigitInputRow
                      ariaLabel={`Liczba odejmowana w kroku ${stepIndex + 1}`}
                      disabled={disabled}
                      expected={checked ? step.subtraction : undefined}
                      values={subtractionAnswers[stepIndex]}
                      onChange={(values) => {
                        setMessage("");
                        setSubtractionAnswers((current) => current.map((row, index) => index === stepIndex ? values : row));
                      }}
                    />
                  </div>
                  <div className="division-step-rule" />
                </div>
                {stepIndex < steps.length - 1 && step.remainder === 0 && (
                  <div
                    className="division-aligned-row division-intermediate-zero-row"
                    style={{ "--trailing-columns": trailingColumns } as CSSProperties}
                  >
                    <DigitInputRow
                      ariaLabel={`Wynik odejmowania w kroku ${stepIndex + 1}`}
                      disabled={disabled}
                      expected={checked ? "0" : undefined}
                      values={intermediateZeroAnswers[stepIndex]}
                      onChange={(values) => {
                        setMessage("");
                        setIntermediateZeroAnswers((current) => current.map(
                          (row, index) => index === stepIndex ? values : row,
                        ));
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}

          <div className="division-final-row">
            <DigitInputRow
              ariaLabel="Reszta"
              disabled={disabled}
              expected={checked ? expectedRemainder : undefined}
              values={remainderAnswer}
              onChange={(values) => { setMessage(""); setRemainderAnswer(values); }}
            />
            <span>reszta</span>
          </div>
        </div>
      </div>

      {message && <p className="feedback warning-feedback">{message}</p>}
      {!disabled && <button className="quiz-action" onClick={check} type="button">Sprawdź</button>}
    </div>
  );
}

export function calculateDivisionSteps(dividend: number, divisor: number): DivisionStep[] {
  const steps: DivisionStep[] = [];
  let remainder = 0;
  let quotientStarted = false;

  String(dividend).split("").forEach((digit, columnIndex) => {
    const partialDividend = remainder * 10 + Number(digit);
    if (!quotientStarted && partialDividend < divisor) {
      remainder = partialDividend;
      return;
    }

    quotientStarted = true;
    const quotientDigit = Math.floor(partialDividend / divisor);
    const subtraction = quotientDigit * divisor;
    remainder = partialDividend - subtraction;
    steps.push({
      columnIndex,
      partialDividend: String(partialDividend),
      subtraction: String(subtraction),
      remainder,
    });
  });

  return steps;
}
