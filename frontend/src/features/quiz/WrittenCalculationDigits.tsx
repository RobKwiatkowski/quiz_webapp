import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

interface DigitInputRowProps {
  ariaLabel: string;
  values: string[];
  disabled: boolean;
  expected?: string;
  onChange: (values: string[]) => void;
}

export function DigitInputRow({ ariaLabel, values, disabled, expected, onChange }: DigitInputRowProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const updateFrom = (startIndex: number, rawValue: string) => {
    const digits = rawValue.replace(/\D/g, "").split("");
    if (digits.length === 0) {
      onChange(values.map((value, index) => index === startIndex ? "" : value));
      return;
    }

    const next = [...values];
    digits.slice(0, values.length - startIndex).forEach((digit, offset) => {
      next[startIndex + offset] = digit;
    });
    onChange(next);
    refs.current[Math.min(startIndex + digits.length, values.length - 1)]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === "Backspace" && !values[index] && index > 0) refs.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < values.length - 1) refs.current[index + 1]?.focus();
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>, index: number) => {
    event.preventDefault();
    updateFrom(index, event.clipboardData.getData("text"));
  };

  return (
    <div className="written-digit-row" role="group" aria-label={ariaLabel}>
      {values.map((value, index) => {
        const resultClass = expected == null
          ? ""
          : value === expected[index] ? "digit-correct" : "digit-incorrect";
        return (
          <input
            aria-label={`${ariaLabel}, cyfra ${index + 1}`}
            className={`written-digit-input ${resultClass}`}
            disabled={disabled}
            inputMode="numeric"
            key={index}
            maxLength={1}
            onChange={(event) => updateFrom(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onPaste={(event) => handlePaste(event, index)}
            pattern="[0-9]*"
            ref={(element) => { refs.current[index] = element; }}
            value={value}
          />
        );
      })}
    </div>
  );
}

export function StaticDigitRow({ value }: { value: string }) {
  return (
    <div className="written-static-digit-row" aria-label={value}>
      {value.split("").map((digit, index) => (
        <span aria-hidden="true" className="written-static-digit" key={`${digit}-${index}`}>
          {digit}
        </span>
      ))}
    </div>
  );
}
