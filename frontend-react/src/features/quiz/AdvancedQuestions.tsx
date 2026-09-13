import { useMemo, useState } from "react";
import { checkAnswerWithLlm, type QuizQuestion } from "../../api/quiz-api";
import type { QuizFeedback } from "./quiz-session";

export function OrderQuestion({ question, disabled, onComplete }: Props) {
  const [items, setItems] = useState(() => shuffle(question.order_items));
  const move = (index: number, delta: number) => {
    const next = [...items];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setItems(next);
  };
  const check = () => {
    const correct = items.every((item, index) => item.position === index + 1);
    onComplete(feedback(correct, question));
  };
  return <div className="advanced-question"><div className="order-list">{items.map((item, index) => <div className="order-row" key={item.id}><span>{item.text}</span><span><button disabled={disabled || index === 0} onClick={() => move(index, -1)} type="button">↑</button><button disabled={disabled || index === items.length - 1} onClick={() => move(index, 1)} type="button">↓</button></span></div>)}</div>{!disabled && <button className="quiz-action" onClick={check} type="button">Sprawdź</button>}</div>;
}

export function MatchingQuestion({ question, disabled, onComplete }: Props) {
  const choices = useMemo(() => shuffle([...new Set(question.matching_pairs.map((pair) => pair.right))]), [question.id, question.matching_pairs]);
  const pairs = useMemo(() => shuffle(question.matching_pairs), [question.id, question.matching_pairs]);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const check = () => onComplete(feedback(question.matching_pairs.every((pair) => matches[pair.id] === pair.right), question));
  return <div className="advanced-question"><div className="matching-list">{pairs.map((pair) => <label className="matching-row" key={pair.id}><span>{pair.left}</span><select disabled={disabled} value={matches[pair.id] ?? ""} onChange={(event) => setMatches({ ...matches, [pair.id]: event.target.value })}><option value="">Wybierz dopasowanie</option>{choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select></label>)}</div>{!disabled && <button className="quiz-action" onClick={check} type="button">Sprawdź</button>}</div>;
}

export function LlmQuestion({ question, disabled, onComplete }: Props) {
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const check = async () => {
    if (!answer.trim()) { setMessage("Wpisz odpowiedź."); return; }
    setChecking(true); setMessage("Sprawdzam odpowiedź...");
    try { const result = await checkAnswerWithLlm(question, answer.trim()); const points = Math.max(0, Math.min(Number(result.points) || 0, 1)); onComplete({ isCorrect: points === 1, explanation: result.feedback, earnedPoints: points, maximumPoints: 1 }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Nieznany błąd."); }
    finally { setChecking(false); }
  };
  return <div className="advanced-question"><label className="open-answer-label">Twoja odpowiedź<textarea disabled={disabled || checking} value={answer} onChange={(event) => setAnswer(event.target.value)} /></label>{message && <p className="feedback feedback-warning">{message}</p>}{!disabled && <button className="quiz-action" disabled={checking} onClick={check} type="button">Sprawdź</button>}</div>;
}

interface Props { question: QuizQuestion; disabled: boolean; onComplete: (feedback: QuizFeedback) => void; }
function feedback(isCorrect: boolean, question: QuizQuestion): QuizFeedback { return { isCorrect, explanation: question.explanation ?? "", earnedPoints: isCorrect ? 1 : 0, maximumPoints: 1 }; }
function shuffle<T>(items: readonly T[]): T[] { const result = [...items]; for (let index = result.length - 1; index > 0; index -= 1) { const other = Math.floor(Math.random() * (index + 1)); [result[index], result[other]] = [result[other], result[index]]; } return result; }
