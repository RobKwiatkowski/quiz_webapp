import { motion } from "motion/react";
import { useEffect, useMemo, useState, type DragEvent, type KeyboardEvent } from "react";
import { checkAnswerWithLlm, type QuizQuestion } from "../../api/quiz-api";
import type { QuizFeedback } from "./quiz-session";

export function OrderQuestion({ question, disabled, onComplete }: Props) {
  const [items, setItems] = useState(() => shuffle(question.order_items));
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [keyboardDraggedItemId, setKeyboardDraggedItemId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [landedItemId, setLandedItemId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!landedItemId) return;
    const timer = window.setTimeout(() => setLandedItemId(null), 500);
    return () => window.clearTimeout(timer);
  }, [landedItemId]);

  const moveItem = (sourceId: string, targetIndex: number) => {
    setItems((currentItems) => placeItemAtIndex(currentItems, sourceId, targetIndex));
    setLandedItemId(sourceId);
  };

  const moveItemByOffset = (itemId: string, direction: -1 | 1) => {
    const itemIndex = items.findIndex((item) => item.id === itemId);
    const targetIndex = itemIndex + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    moveItem(itemId, targetIndex);
    setAnnouncement(`Element przeniesiono na pozycję ${targetIndex + 1}.`);
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, itemId: string) => {
    if (disabled || (event.target as HTMLElement).closest("button")) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
    setDraggedItemId(itemId);
    setDropTargetIndex(null);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, targetIndex: number) => {
    if (disabled || !draggedItemId) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const sourceIndex = items.findIndex((item) => item.id === draggedItemId);
    if (sourceIndex === targetIndex) {
      setDropTargetIndex(null);
      return;
    }

    setDropTargetIndex(targetIndex);
    setAnnouncement(`Kafelek trafi na pozycję ${targetIndex + 1}.`);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, targetIndex: number) => {
    const sourceId = draggedItemId || event.dataTransfer.getData("text/plain");
    if (disabled || !sourceId) return;

    event.preventDefault();
    event.stopPropagation();
    moveItem(sourceId, targetIndex);
    setAnnouncement(`Kafelek upuszczono na pozycji ${targetIndex + 1}.`);
    setDraggedItemId(null);
    setDropTargetIndex(null);
  };

  const handleKeyboardMove = (event: KeyboardEvent<HTMLDivElement>, itemId: string, index: number) => {
    if (disabled) {
      return;
    }

    if (event.key === " ") {
      event.preventDefault();
      const isReleasingItem = keyboardDraggedItemId === itemId;
      setKeyboardDraggedItemId(isReleasingItem ? null : itemId);
      setAnnouncement(
        isReleasingItem
          ? "Element został odłożony."
          : "Wybrano element. Użyj strzałek w górę i w dół, aby zmienić jego pozycję.",
      );
      return;
    }

    if (event.key === "Escape" && keyboardDraggedItemId === itemId) {
      event.preventDefault();
      setKeyboardDraggedItemId(null);
      setAnnouncement("Zakończono zmianę kolejności.");
      return;
    }

    if (keyboardDraggedItemId !== itemId || !["ArrowUp", "ArrowDown"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const targetIndex = event.key === "ArrowUp" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) {
      setAnnouncement("Element jest już na skraju listy.");
      return;
    }

    moveItem(itemId, targetIndex);
    setAnnouncement(`Element przeniesiono na pozycję ${targetIndex + 1}.`);
  };

  const check = () => {
    const correct = items.every((item, index) => item.position === index + 1);
    onComplete(feedback(correct, question));
  };

  return (
    <div className="advanced-question">
      <p id="order-instructions" className="order-direction-hint">
        Przeciągnij kafelek na wybrane pole albo użyj strzałek góra/dół. Podświetlone pole pokazuje dokładną pozycję docelową.
      </p>
      <div
        className="order-list"
        role="list"
        aria-describedby="order-instructions"
        aria-disabled={disabled}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTargetIndex(null);
        }}
      >
        {items.map((item, index) => {
          const isKeyboardDragging = keyboardDraggedItemId === item.id && !disabled;
          const isDropTarget = dropTargetIndex === index;

          return (
            <div className="order-list-item" key={`position-${index}`} role="listitem">
              <span className="order-position" aria-label={`Miejsce ${index + 1} od góry`}>{index + 1}</span>
              <motion.div
                key={item.id}
                className={`order-row ${draggedItemId === item.id ? "is-dragging" : ""} ${isKeyboardDragging ? "is-keyboard-dragging" : ""} ${isDropTarget ? "is-drop-target" : ""} ${landedItemId === item.id ? "has-landed" : ""}`}
                tabIndex={disabled ? -1 : 0}
                draggable={!disabled}
                aria-grabbed={isKeyboardDragging}
                aria-label={`Pozycja ${index + 1} z ${items.length}: ${item.text}. Przeciągnij, aby zmienić kolejność.`}
                onDragStartCapture={(event) => handleDragStart(event, item.id)}
                onDragEnter={(event) => handleDragOver(event, index)}
                onDragOver={(event) => handleDragOver(event, index)}
                onDrop={(event) => handleDrop(event, index)}
                onDragEnd={() => {
                  setDraggedItemId(null);
                  setDropTargetIndex(null);
                }}
                onKeyDown={(event) => handleKeyboardMove(event, item.id, index)}
              >
                <span className="order-drag-handle" aria-hidden="true">⠿</span>
                <span className="order-item-text">{item.text}</span>
                <span className="order-actions" aria-label={`Przesuń ${item.text}`}>
                  <button aria-label={`Przesuń ${item.text} wyżej`} disabled={disabled || index === 0} draggable={false} onClick={() => moveItemByOffset(item.id, -1)} type="button">↑</button>
                  <button aria-label={`Przesuń ${item.text} niżej`} disabled={disabled || index === items.length - 1} draggable={false} onClick={() => moveItemByOffset(item.id, 1)} type="button">↓</button>
                </span>
                {isDropTarget && <span className="order-drop-overlay" aria-hidden="true">Upuść tutaj — pozycja {index + 1}</span>}
              </motion.div>
            </div>
          );
        })}
      </div>
      <p className="order-live-region" aria-live="polite">{announcement}</p>
      {!disabled && <button className="quiz-action" onClick={check} type="button">Sprawdź</button>}
    </div>
  );
}

export function CenturyQuestion({ question, disabled, onComplete }: Props) {
  const [answer, setAnswer] = useState("");
  const [centuryHalf, setCenturyHalf] = useState<"" | "first" | "second">("");
  const [message, setMessage] = useState("");
  const correctAnswer = question.correct_century ? toRoman(question.correct_century) : "";

  const check = () => {
    if (!answer.trim() || !centuryHalf) {
      setMessage("Wpisz wiek i wybierz jego połowę.");
      return;
    }

    const isCorrect = correctAnswer !== ""
      && normalizeRomanAnswer(answer) === correctAnswer
      && centuryHalf === question.correct_century_half;
    setMessage("");
    onComplete(feedback(isCorrect, question));
  };

  return (
    <div className="advanced-question">
      <div className="century-answer-grid">
        <label className="open-answer-label">
          Wpisz liczbę rzymską oznaczającą wiek
          <input
            disabled={disabled}
            value={answer}
            placeholder="Np. V"
            aria-label="Liczba rzymska oznaczająca wiek"
            onChange={(event) => setAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                check();
              }
            }}
          />
        </label>
        <label className="open-answer-label">
          Wybierz połowę wieku
          <select
            aria-label="Połowa wieku"
            disabled={disabled}
            value={centuryHalf}
            onChange={(event) => setCenturyHalf(event.target.value as "" | "first" | "second")}
          >
            <option value="">Wybierz…</option>
            <option value="first">I połowa</option>
            <option value="second">II połowa</option>
          </select>
        </label>
      </div>
      {message && <p className="feedback warning-feedback">{message}</p>}
      {!disabled && <button className="quiz-action" onClick={check} type="button">Sprawdź</button>}
    </div>
  );
}

export function MatchingQuestion({ question, disabled, onComplete }: Props) {
  const choices = useMemo(() => shuffle([...new Set(question.matching_pairs.map((pair) => pair.right))]), [question.id, question.matching_pairs]);
  const pairs = useMemo(() => shuffle(question.matching_pairs), [question.id, question.matching_pairs]);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [message, setMessage] = useState("");
  const check = () => {
    if (pairs.some((pair) => !matches[pair.id])) {
      setMessage("Dopasuj wszystkie elementy przed sprawdzeniem.");
      return;
    }
    const isCorrect = question.matching_pairs.every((pair) => matches[pair.id] === pair.right);
    setChecked(true);
    setMessage("");
    onComplete(feedback(isCorrect, question));
  };
  return <div className="advanced-question"><div className="matching-list">{pairs.map((pair) => {
    const rowState = checked ? matches[pair.id] === pair.right ? "correct" : "incorrect" : "";
    return <div className={`matching-row ${rowState}`} key={pair.id}><span className="matching-left">{pair.left}</span><select className="matching-select" disabled={disabled} value={matches[pair.id] ?? ""} onChange={(event) => setMatches({ ...matches, [pair.id]: event.target.value })}><option value="">Wybierz dopasowanie</option>{choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select></div>;
  })}</div>{message && <p className="feedback warning-feedback">{message}</p>}{!disabled && <button id="check-button" onClick={check} type="button">Sprawdź</button>}</div>;
}

export function LlmQuestion({ question, disabled, onComplete }: Props) {
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const check = async () => {
    if (!answer.trim()) { setMessage("Wpisz odpowiedź."); return; }
    setChecking(true); setMessage("");
    try { const result = await checkAnswerWithLlm(question, answer.trim()); const points = Math.max(0, Math.min(Number(result.points) || 0, 1)); onComplete({ isCorrect: points === 1, explanation: result.feedback, earnedPoints: points, maximumPoints: 1 }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Nieznany błąd."); }
    finally { setChecking(false); }
  };
  return <div className="advanced-question"><label className="open-answer-label">Twoja odpowiedź<textarea disabled={disabled || checking} value={answer} onChange={(event) => setAnswer(event.target.value)} /></label>{message && <p className="feedback warning-feedback">{message}</p>}{!disabled && (checking ? <JumpingDotsLoader /> : <button className="quiz-action" onClick={check} type="button">Sprawdź</button>)}</div>;
}

interface Props { question: QuizQuestion; disabled: boolean; onComplete: (feedback: QuizFeedback) => void; }
function placeItemAtIndex<T extends { id: string }>(
  items: readonly T[],
  sourceId: string,
  targetIndex: number,
): T[] {
  const sourceIndex = items.findIndex((item) => item.id === sourceId);
  if (sourceIndex === -1 || sourceIndex === targetIndex) return [...items];

  const nextItems = [...items];
  const [sourceItem] = nextItems.splice(sourceIndex, 1);
  nextItems.splice(targetIndex, 0, sourceItem);
  return nextItems;
}
function feedback(isCorrect: boolean, question: QuizQuestion): QuizFeedback { return { isCorrect, explanation: question.explanation ?? "", earnedPoints: isCorrect ? 1 : 0, maximumPoints: 1 }; }
function shuffle<T>(items: readonly T[]): T[] { const result = [...items]; for (let index = result.length - 1; index > 0; index -= 1) { const other = Math.floor(Math.random() * (index + 1)); [result[index], result[other]] = [result[other], result[index]]; } return result; }
function normalizeRomanAnswer(value: string): string { return value.trim().toUpperCase().replace(/[.\s]+/g, ""); }
function toRoman(number: number): string { const numerals: Array<[number, string]> = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]; let result = ""; for (const [value, symbol] of numerals) { while (number >= value) { result += symbol; number -= value; } } return result; }

function JumpingDotsLoader() {
  return (
    <div className="llm-loader" aria-live="polite" aria-busy="true">
      <div className="jumping-dots" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="jumping-dot"
            animate={{ y: [0, -7, 0] }}
            transition={{
              duration: 0.55,
              repeat: Infinity,
              ease: "easeInOut",
              delay: index * 0.12,
            }}
          />
        ))}
      </div>
      <span>Analizuję odpowiedź...</span>
    </div>
  );
}
