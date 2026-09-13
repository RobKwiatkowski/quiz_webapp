import { useEffect, useMemo, useReducer, useState } from "react";
import { getQuizById, type Answer, type Quiz, type QuizQuestion } from "../api/quiz-api";
import {
  getFinalGrade,
  getFinalMessage,
  getOpenAnswerPoints,
  getQuestionMaxPoints,
  getQuizMaxPoints,
  getScorePercentage,
} from "../features/quiz/quiz-scoring";
import {
  initialQuizSessionState,
  quizSessionReducer,
  type QuizFeedback,
} from "../features/quiz/quiz-session";
import { LlmQuestion, MatchingQuestion, OrderQuestion } from "../features/quiz/AdvancedQuestions";

type QuizLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; quiz: Quiz };

interface AnswerChoice {
  answer: Answer;
  originalIndex: number;
}

export function QuizPage() {
  const [loadState, setLoadState] = useState<QuizLoadState>({ status: "loading" });
  const [session, dispatch] = useReducer(quizSessionReducer, initialQuizSessionState);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const quizId = new URLSearchParams(window.location.search).get("id");
  const section = new URLSearchParams(window.location.search).get("section") ?? "history";

  useEffect(() => {
    if (!quizId) {
      setLoadState({ status: "error", message: "Brak id quizu w adresie." });
      return;
    }

    const controller = new AbortController();
    setLoadState({ status: "loading" });
    dispatch({ type: "restart" });

    getQuizById(quizId, controller.signal)
      .then((quiz) => setLoadState({ status: "ready", quiz }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState({
          status: "error",
          message: error instanceof Error ? error.message : "Nieznany błąd.",
        });
      });

    return () => controller.abort();
  }, [quizId]);

  if (loadState.status === "loading") {
    return <main className="subject-shell"><p className="subject-status">Ładowanie quizu...</p></main>;
  }

  if (loadState.status === "error") {
    return <main className="subject-shell"><p className="subject-status subject-status-error">{loadState.message}</p></main>;
  }

  const { quiz } = loadState;
  if (quiz.questions.length === 0) {
    return <main className="subject-shell"><p className="subject-status">Quiz nie zawiera pytań.</p></main>;
  }

  if (session.currentQuestionIndex >= quiz.questions.length) {
    return <ResultScreen quiz={quiz} score={session.earnedPoints} section={section} onRestart={() => dispatch({ type: "restart" })} />;
  }

  const question = quiz.questions[session.currentQuestionIndex];
  const maximumPoints = getQuestionMaxPoints(question);
  const questionPosition = session.currentQuestionIndex + 1;
  const progress = Math.round((questionPosition / quiz.questions.length) * 100);
  const completeAnswer = (feedback: QuizFeedback) => {
    setValidationMessage(null);
    dispatch({ type: "submit", feedback });
  };

  const handleCheck = () => {
    if (question.selection_type === "multiple") {
      if (session.selectedAnswerIndexes.length === 0) return;
      const selectedAnswers = session.selectedAnswerIndexes.map((index) => question.answers[index]);
      const isCorrect = selectedAnswers.every((answer) => answer.is_correct)
        && selectedAnswers.length === question.answers.filter((answer) => answer.is_correct).length;
      completeAnswer({
        isCorrect,
        explanation: question.explanation ?? "",
        earnedPoints: isCorrect ? 1 : 0,
        maximumPoints,
      });
      return;
    }

    if (question.selection_type === "open") {
      if (session.openAnswers.every((answer) => !answer?.trim())) {
        setValidationMessage("Wpisz odpowiedź.");
        return;
      }

      const earnedPoints = getOpenAnswerPoints(question, session.openAnswers);
      completeAnswer({
        isCorrect: earnedPoints === maximumPoints,
        explanation: question.explanation ?? "",
        earnedPoints,
        maximumPoints,
      });
    }
  };

  return (
    <main className="subject-shell quiz-shell">
      <nav aria-label="Nawigacja quizu">
        <a className="back-link" href={`${section}.html`}>← Wróć do listy quizów</a>
      </nav>
      <header className="quiz-header">
        <h1>{quiz.title}</h1>
        <p>{quiz.description}</p>
      </header>
      <section className="question-card" aria-labelledby="question-text">
        <p>Pytanie {questionPosition} z {quiz.questions.length}</p>
        <div className="progress-track" aria-label="Postęp quizu" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <p className="quiz-count">{progress}%</p>
        <QuestionContext question={question} />
        <h2 id="question-text">{question.text}</h2>
        <QuestionImage question={question} />
        <QuestionRenderer
          question={question}
          selectedAnswerIndexes={session.selectedAnswerIndexes}
          openAnswers={session.openAnswers}
          hasAnswered={session.hasAnswered}
          onSelectAnswer={(answerIndex) => {
            setValidationMessage(null);
            if (question.selection_type === "single") {
              const answer = question.answers[answerIndex];
              dispatch({ type: "select-answer", answerIndex });
              completeAnswer({
                isCorrect: answer.is_correct,
                explanation: question.explanation ?? "",
                earnedPoints: answer.is_correct ? 1 : 0,
                maximumPoints,
              });
              return;
            }
            dispatch({ type: "toggle-answer", answerIndex });
          }}
          onOpenAnswerChange={(slotIndex, value) => {
            setValidationMessage(null);
            dispatch({ type: "set-open-answer", slotIndex, value });
          }}
          onSubmitOpen={handleCheck}
          onComplete={completeAnswer}
        />
        {validationMessage && <p className="feedback feedback-warning">{validationMessage}</p>}
        {session.feedback && <FeedbackPanel feedback={session.feedback} />}
        {!session.hasAnswered && (question.selection_type === "multiple" || question.selection_type === "open") && (
          <button className="quiz-action" type="button" onClick={handleCheck}>Sprawdź</button>
        )}
        {session.hasAnswered && (
          <button className="quiz-action" type="button" onClick={() => dispatch({ type: "next-question" })}>Dalej</button>
        )}
      </section>
    </main>
  );
}

interface QuestionRendererProps {
  question: QuizQuestion;
  selectedAnswerIndexes: number[];
  openAnswers: string[];
  hasAnswered: boolean;
  onSelectAnswer: (answerIndex: number) => void;
  onOpenAnswerChange: (slotIndex: number, value: string) => void;
  onSubmitOpen: () => void;
  onComplete: (feedback: QuizFeedback) => void;
}

function QuestionRenderer(props: QuestionRendererProps) {
  if (props.question.selection_type === "single" || props.question.selection_type === "multiple") {
    return <ChoiceQuestion {...props} />;
  }

  if (props.question.selection_type === "open") {
    return <OpenQuestion {...props} />;
  }

  if (props.question.selection_type === "order") return <OrderQuestion question={props.question} disabled={props.hasAnswered} onComplete={props.onComplete} />;
  if (props.question.selection_type === "matching") return <MatchingQuestion question={props.question} disabled={props.hasAnswered} onComplete={props.onComplete} />;
  if (props.question.selection_type === "llm") return <LlmQuestion question={props.question} disabled={props.hasAnswered} onComplete={props.onComplete} />;

  return <p className="subject-status">Ten typ pytania zostanie przeniesiony w kolejnym kroku migracji.</p>;
}

function ChoiceQuestion({ question, selectedAnswerIndexes, hasAnswered, onSelectAnswer }: QuestionRendererProps) {
  const choices = useMemo(
    () => shuffleChoices(question.answers.map((answer, originalIndex) => ({ answer, originalIndex }))),
    [question.id, question.answers],
  );

  return (
    <div className="answer-list">
      {choices.map(({ answer, originalIndex }) => {
        const selected = selectedAnswerIndexes.includes(originalIndex);
        const resultClass = hasAnswered
          ? answer.is_correct ? "answer-correct" : selected ? "answer-incorrect" : ""
          : selected ? "answer-selected" : "";

        return (
          <button
            key={`${question.id}-${originalIndex}`}
            className={`answer-button ${resultClass}`}
            disabled={hasAnswered}
            type="button"
            onClick={() => onSelectAnswer(originalIndex)}
          >
            {answer.text}
          </button>
        );
      })}
    </div>
  );
}

function OpenQuestion({ question, openAnswers, hasAnswered, onOpenAnswerChange, onSubmitOpen }: QuestionRendererProps) {
  const slotCount = question.answer_slots.length || 1;

  return (
    <div className="open-answer-list">
      {Array.from({ length: slotCount }, (_, slotIndex) => (
        <label key={`${question.id}-${slotIndex}`} className="open-answer-label">
          {slotCount > 1 ? `${slotIndex + 1}.` : "Twoja odpowiedź"}
          <input
            disabled={hasAnswered}
            type="text"
            value={openAnswers[slotIndex] ?? ""}
            onChange={(event) => onOpenAnswerChange(slotIndex, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmitOpen();
              }
            }}
          />
        </label>
      ))}
    </div>
  );
}

function QuestionContext({ question }: { question: QuizQuestion }) {
  const contextText = question.context?.text ?? question.source_text;
  if (!contextText) return null;

  return (
    <div className="question-context">
      <p>{contextText}</p>
      {question.context?.source && <p>Źródło: {question.context.source}</p>}
    </div>
  );
}

function QuestionImage({ question }: { question: QuizQuestion }) {
  if (!question.image) return null;
  const imageUrl = question.image.startsWith("http") ? question.image : `${window.CONFIG?.API_BASE_URL ?? ""}${question.image}`;

  return <img className="question-image" src={imageUrl} alt="Obrazek do pytania" />;
}

function FeedbackPanel({ feedback }: { feedback: QuizFeedback }) {
  const message = feedback.isCorrect ? "Dobrze" : feedback.explanation;

  return (
    <p className={`feedback ${feedback.isCorrect ? "feedback-correct" : "feedback-incorrect"}`}>
      {message}
      {feedback.maximumPoints > 1 && <><br />Zdobyte punkty: {feedback.earnedPoints} / {feedback.maximumPoints}</>}
    </p>
  );
}

function ResultScreen({ quiz, score, section, onRestart }: { quiz: Quiz; score: number; section: string; onRestart: () => void }) {
  const maximum = getQuizMaxPoints(quiz);
  const percentage = getScorePercentage(score, maximum);

  return (
    <main className="subject-shell result-screen">
      <h1>Koniec quizu</h1>
      <p>Wynik: {score} / {maximum} pkt</p>
      <p>Procent: {percentage}%</p>
      <p>Ocena: {getFinalGrade(score, maximum)}</p>
      <p>{getFinalMessage(score, maximum)}</p>
      <button className="quiz-action" type="button" onClick={onRestart}>Zagraj jeszcze raz</button>
      <p><a className="back-link" href={`${section}.html`}>Wróć do listy quizów</a></p>
    </main>
  );
}

function shuffleChoices(choices: AnswerChoice[]): AnswerChoice[] {
  const shuffled = [...choices];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}
