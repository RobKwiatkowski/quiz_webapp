import { motion } from "motion/react";
import { useMemo, useState, type DragEvent, type KeyboardEvent } from "react";
import { checkAnswerWithLlm, type QuizQuestion } from "../../api/quiz-api";
import type { QuizFeedback } from "./quiz-session";

export function OrderQuestion({ question, disabled, onComplete }: Props) {
  const [items, setItems] = useState(() => shuffle(question.order_items));
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [keyboardDraggedItemId, setKeyboardDraggedItemId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const moveItem = (sourceId: string, targetId: string | null, placeAfter = false) => {
    setItems((currentItems) => {
      const sourceIndex = currentItems.findIndex((item) => item.id === sourceId);
      if (sourceIndex === -1 || sourceId === targetId) {
        return currentItems;
      }

      const nextItems = [...currentItems];
      const [sourceItem] = nextItems.splice(sourceIndex, 1);

      if (!targetId) {
        nextItems.push(sourceItem);
        return nextItems;
      }

      const targetIndex = nextItems.findIndex((item) => item.id === targetId);
      if (targetIndex === -1) {
        return currentItems;
      }

      nextItems.splice(targetIndex + (placeAfter ? 1 : 0), 0, sourceItem);
      return nextItems;
    });
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, itemId: string) => {
    if (disabled) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
    setDraggedItemId(itemId);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, itemId: string) => {
    if (disabled || !draggedItemId || draggedItemId === itemId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const bounds = event.currentTarget.getBoundingClientRect();
    setDropTarget({ itemId, placeAfter: event.clientY >= bounds.top + bounds.height / 2 });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, itemId: string) => {
    if (disabled || !draggedItemId) {
      return;
    }

    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    moveItem(draggedItemId, itemId, event.clientY >= bounds.top + bounds.height / 2);
    setDraggedItemId(null);
    setDropTarget(null);
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

    moveItem(itemId, items[targetIndex].id, event.key === "ArrowDown");
    setAnnouncement(`Element przeniesiono na pozycję ${targetIndex + 1}.`);
  };

  const check = () => {
    const correct = items.every((item, index) => item.position === index + 1);
    onComplete(feedback(correct, question));
  };

  return (
    <div className="advanced-question">
      <p id="order-instructions" className="order-direction-hint">
        Przeciągnij elementy, aby zmienić ich kolejność. Klawiatura: Spacja, potem strzałki w górę i w dół.
      </p>
      <div
        className={`order-list ${dropTarget?.itemId === null ? "drag-over-list" : ""}`}
        role="list"
        aria-describedby="order-instructions"
        aria-disabled={disabled}
        onDragOver={(event) => {
          if (!disabled && draggedItemId && event.target === event.currentTarget) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setDropTarget({ itemId: null, placeAfter: true });
          }
        }}
        onDrop={(event) => {
          if (!disabled && draggedItemId && event.target === event.currentTarget) {
            event.preventDefault();
            moveItem(draggedItemId, null);
            setDraggedItemId(null);
            setDropTarget(null);
          }
        }}
      >
        {items.map((item, index) => {
          const isKeyboardDragging = keyboardDraggedItemId === item.id && !disabled;
          const dropClass = dropTarget?.itemId === item.id
            ? dropTarget.placeAfter ? "drag-over-below" : "drag-over-above"
            : "";

          return (
            <div
              className={`order-row ${draggedItemId === item.id ? "is-dragging" : ""} ${isKeyboardDragging ? "is-keyboard-dragging" : ""} ${dropClass}`}
              key={item.id}
              role="listitem"
              tabIndex={disabled ? -1 : 0}
              draggable={!disabled}
              aria-grabbed={isKeyboardDragging}
              aria-label={`Pozycja ${index + 1} z ${items.length}: ${item.text}. Przeciągnij, aby zmienić kolejność.`}
              onDragStart={(event) => handleDragStart(event, item.id)}
              onDragOver={(event) => handleDragOver(event, item.id)}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setDropTarget(null);
                }
              }}
              onDrop={(event) => handleDrop(event, item.id)}
              onDragEnd={() => {
                setDraggedItemId(null);
                setDropTarget(null);
              }}
              onKeyDown={(event) => handleKeyboardMove(event, item.id, index)}
            >
              <span className="order-position" aria-label={`Miejsce ${index + 1} od góry`}>{index + 1}</span>
              <span className="order-drag-handle" aria-hidden="true">⠿</span>
              <span className="order-item-text">{item.text}</span>
            </div>
          );
        })}
      </div>
      <p className="order-live-region" aria-live="polite">{announcement}</p>
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
interface DropTarget { itemId: string | null; placeAfter: boolean; }
function feedback(isCorrect: boolean, question: QuizQuestion): QuizFeedback { return { isCorrect, explanation: question.explanation ?? "", earnedPoints: isCorrect ? 1 : 0, maximumPoints: 1 }; }
function shuffle<T>(items: readonly T[]): T[] { const result = [...items]; for (let index = result.length - 1; index > 0; index -= 1) { const other = Math.floor(Math.random() * (index + 1)); [result[index], result[other]] = [result[other], result[index]]; } return result; }

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
