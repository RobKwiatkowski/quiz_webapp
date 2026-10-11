import { useState } from "react";
import type { QuizQuestion } from "../../api/quiz-api";
import type { QuizFeedback } from "./quiz-session";

interface GraphQuestionProps {
  question: QuizQuestion;
  disabled: boolean;
  onComplete: (feedback: QuizFeedback) => void;
}

export function GraphQuestion({ question, disabled, onComplete }: GraphQuestionProps) {
  const config = question.graph_config;
  const [xAxis, setXAxis] = useState("");
  const [yAxis, setYAxis] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState("");

  if (!config) return <p className="subject-status">Brakuje ustawień wykresu.</p>;

  const pointKey = (x: number, y: number) => `${x},${y}`;
  const expected = new Set(config.points.map((point) => pointKey(point.x, point.y)));
  const isCorrect = xAxis === config.x_axis
    && yAxis === config.y_axis
    && selected.size === expected.size
    && [...selected].every((point) => expected.has(point));

  const togglePoint = (x: number, y: number) => {
    if (disabled) return;
    const key = pointKey(x, y);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const submit = () => {
    if (!xAxis || !yAxis) {
      setMessage("Najpierw wybierz opisy obu osi.");
      return;
    }
    if (!selected.size) {
      setMessage("Zaznacz punkty na wykresie.");
      return;
    }
    onComplete({
      isCorrect,
      explanation: question.explanation ?? "",
      earnedPoints: isCorrect ? 1 : 0,
      maximumPoints: 1,
    });
  };

  const xValues = Array.from({ length: config.x_max + 1 }, (_, index) => index);
  const yValues = [...(config.y_values ?? Array.from({ length: config.y_max + 1 }, (_, index) => index))].reverse();

  return (
    <section className="graph-question" aria-label="Interaktywny wykres">
      {config.data_table && <div className="graph-data-table-wrap">
        <table className="graph-data-table">
          <caption>Dane do wykresu</caption>
          <thead><tr>{config.data_table.headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
          <tbody>{config.data_table.rows.map((row, rowIndex) => <tr key={`${rowIndex}-${row.join("-")}`}>{row.map((value, valueIndex) => <td key={`${rowIndex}-${valueIndex}`}>{value}</td>)}</tr>)}</tbody>
        </table>
      </div>}
      <p className="graph-instruction">1. Wybierz opisy osi. 2. Zaznacz punkty wykresu.</p>
      <div className="graph-axis-selectors">
        <fieldset disabled={disabled}>
          <legend>Oś pozioma</legend>
          {config.x_axis_options.map((option) => (
            <label key={option}><input checked={xAxis === option} name={`${question.id}-x-axis`} onChange={() => setXAxis(option)} type="radio" />{option}</label>
          ))}
        </fieldset>
        <fieldset disabled={disabled}>
          <legend>Oś pionowa</legend>
          {config.y_axis_options.map((option) => (
            <label key={option}><input checked={yAxis === option} name={`${question.id}-y-axis`} onChange={() => setYAxis(option)} type="radio" />{option}</label>
          ))}
        </fieldset>
      </div>
      {xAxis && yAxis && <div className="graph-grid-wrap">
        <span className="graph-y-label">{yAxis}</span>
        <div className="graph-grid" style={{ gridTemplateColumns: `auto repeat(${xValues.length}, minmax(2.25rem, 1fr))` }}>
          <span className="graph-corner" />
          {xValues.map((value) => <span className="graph-x-tick" key={`x-${value}`}>{value}</span>)}
          {yValues.flatMap((y) => [
            <span className="graph-y-tick" key={`y-${y}`}>{y}</span>,
            ...xValues.map((x) => {
              const key = pointKey(x, y);
              return <button aria-label={`Punkt ${x}, ${y}`} className={`graph-cell ${selected.has(key) ? "graph-cell-selected" : ""}`} disabled={disabled} key={key} onClick={() => togglePoint(x, y)} type="button"><span /></button>;
            }),
          ])}
          <svg aria-hidden="true" className="graph-line-overlay" viewBox={`0 0 ${config.x_max} ${config.y_max}`} preserveAspectRatio="none">
            {selected.size > 1 && <polyline points={[...selected]
              .map((point) => point.split(",").map(Number) as [number, number])
              .sort(([firstX], [secondX]) => firstX - secondX)
              .map(([x, y]) => `${x},${config.y_max - y}`)
              .join(" ")} />}
          </svg>
        </div>
        <span className="graph-x-label">{xAxis}</span>
      </div>}
      {message && <p className="feedback warning-feedback">{message}</p>}
      {!disabled && <button className="quiz-action" onClick={submit} type="button">Sprawdź wykres</button>}
    </section>
  );
}
