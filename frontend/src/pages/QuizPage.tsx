import confetti from "canvas-confetti";
import { animate, motion, useSpring } from "motion/react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { getQuizById, type Answer, type Quiz, type QuizQuestion } from "../api/quiz-api";
import {
  getFinalGrade,
  getFinalMessage,
  getFillAnswerPoints,
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
import { CenturyQuestion, LlmQuestion, MatchingQuestion, OrderQuestion } from "../features/quiz/AdvancedQuestions";
import { HotspotQuestion } from "../features/quiz/HotspotQuestion";
import { MapQuestion } from "../features/quiz/MapQuestion";
import { TrueFalseQuestion } from "../features/quiz/TrueFalseQuestion";

const PERFECT_SCORE_AUDIO_URL = "/assets/sounds/perfect-score-crowd.mp3";

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
  const [attempt, setAttempt] = useState(0);
  const nextActionRef = useRef<(() => void) | null>(null);
  const quizId = new URLSearchParams(window.location.search).get("id");
  const section = new URLSearchParams(window.location.search).get("section") ?? "history";

  nextActionRef.current = null;

  const startNewAttempt = () => {
    setValidationMessage(null);
    dispatch({ type: "restart" });
    setLoadState({ status: "loading" });
    setAttempt((currentAttempt) => currentAttempt + 1);
  };

  useEffect(() => {
    const advanceWithEnter = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.repeat || event.isComposing) return;

      const nextAction = nextActionRef.current;
      if (!nextAction) return;

      event.preventDefault();
      nextActionRef.current = null;
      nextAction();
    };

    window.addEventListener("keydown", advanceWithEnter, true);
    return () => window.removeEventListener("keydown", advanceWithEnter, true);
  }, []);

  useEffect(() => {
    if (!quizId) {
      setLoadState({ status: "error", message: "Brak id quizu w adresie." });
      return;
    }

    const controller = new AbortController();
    setLoadState({ status: "loading" });
    dispatch({ type: "restart" });

    getQuizById(quizId, controller.signal, attempt)
      .then((quiz) => setLoadState({ status: "ready", quiz }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState({
          status: "error",
          message: error instanceof Error ? error.message : "Nieznany błąd.",
        });
      });

    return () => controller.abort();
  }, [quizId, attempt]);

  if (loadState.status === "loading") {
    return <main className="container quiz-play-shell"><p className="subject-status">Ładowanie quizu...</p></main>;
  }

  if (loadState.status === "error") {
    return <main className="container quiz-play-shell"><p className="subject-status subject-status-error">{loadState.message}</p></main>;
  }

  const { quiz } = loadState;
  if (quiz.questions.length === 0) {
    return <main className="container quiz-play-shell"><p className="subject-status">Quiz nie zawiera pytań.</p></main>;
  }

  if (session.currentQuestionIndex >= quiz.questions.length) {
    return <ResultScreen quiz={quiz} score={session.earnedPoints} section={section} onRestart={startNewAttempt} />;
  }

  const question = quiz.questions[session.currentQuestionIndex];
  const maximumPoints = getQuestionMaxPoints(question);
  const questionPosition = session.currentQuestionIndex + 1;
  const progress = Math.round((questionPosition / quiz.questions.length) * 100);
  const showFeedbackPanel = question.selection_type !== "map";
  const completeAnswer = (feedback: QuizFeedback) => {
    setValidationMessage(null);
    dispatch({ type: "submit", feedback });
  };

  const handleNextQuestion = () => {
    if (questionPosition === quiz.questions.length && session.earnedPoints === getQuizMaxPoints(quiz)) {
      playPerfectScoreAudio();
    }
    dispatch({ type: "next-question" });
  };

  if (session.hasAnswered) nextActionRef.current = handleNextQuestion;

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
      return;
    }

    if (question.selection_type === "fill") {
      if (session.fillAnswers.length !== question.fill_blanks.length || session.fillAnswers.some((answer) => !answer?.trim())) {
        setValidationMessage("Uzupełnij wszystkie luki.");
        return;
      }

      const earnedPoints = getFillAnswerPoints(question, session.fillAnswers);
      completeAnswer({
        isCorrect: earnedPoints === maximumPoints,
        explanation: question.explanation ?? "",
        earnedPoints,
        maximumPoints,
      });
    }
  };

  return (
    <main className="container quiz-play-shell">
      <nav className="quiz-top-nav" aria-label="Nawigacja quizu">
        <a className="quiz-menu-tile" href={`${section}.html`}>
          <span className="quiz-menu-icon" aria-hidden="true">←</span>
          <span>Quizy z {section === "geography" ? "geografii" : section === "biology" ? "biologii" : "historii"}</span>
        </a>
      </nav>
      <header className="quiz-header">
        <h1 id="quiz-title">{quiz.title}</h1>
        <p id="quiz-description">{quiz.description}</p>
      </header>
      <section className="question-card" aria-labelledby="question-text">
        <button
          aria-label="Rozpocznij quiz od początku"
          className="quiz-reset-button"
          onClick={startNewAttempt}
          title="Rozpocznij quiz od początku"
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M6 21V4" />
            <path className="quiz-reset-flag-cloth" d="M6 5h11l-2.5 4L17 13H6Z" />
          </svg>
        </button>
        <p id="question-counter">Pytanie {questionPosition} z {quiz.questions.length}</p>
        <AnimatedProgressBar progress={progress} />
        <p className="question-progress-percent">{progress}%</p>
        <QuestionContext question={question} />
        <h2 id="question-text">{question.selection_type === "fill" ? "Uzupełnij tekst." : question.text}</h2>
        <QuestionImage question={question} />
        <QuestionRenderer
          question={question}
          selectedAnswerIndexes={session.selectedAnswerIndexes}
          openAnswers={session.openAnswers}
          fillAnswers={session.fillAnswers}
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
          onFillAnswerChange={(blankIndex, value) => {
            setValidationMessage(null);
            dispatch({ type: "set-fill-answer", blankIndex, value });
          }}
          onComplete={completeAnswer}
        />
        {validationMessage && <p className="feedback warning-feedback">{validationMessage}</p>}
        {session.feedback && showFeedbackPanel && <FeedbackPanel feedback={session.feedback} />}
        {!session.hasAnswered && (question.selection_type === "multiple" || question.selection_type === "open" || question.selection_type === "fill") && (
          <button id="check-button" type="button" onClick={handleCheck}>Sprawdź</button>
        )}
        {session.hasAnswered && (
          <button id="next-button" type="button" onClick={handleNextQuestion}>Dalej</button>
        )}
      </section>
    </main>
  );
}

interface QuestionRendererProps {
  question: QuizQuestion;
  selectedAnswerIndexes: number[];
  openAnswers: string[];
  fillAnswers: string[];
  hasAnswered: boolean;
  onSelectAnswer: (answerIndex: number) => void;
  onOpenAnswerChange: (slotIndex: number, value: string) => void;
  onSubmitOpen: () => void;
  onFillAnswerChange: (blankIndex: number, value: string) => void;
  onComplete: (feedback: QuizFeedback) => void;
}

function QuestionRenderer(props: QuestionRendererProps) {
  if (props.question.selection_type === "single" || props.question.selection_type === "multiple") {
    return <ChoiceQuestion {...props} />;
  }

  if (props.question.selection_type === "open") {
    return <OpenQuestion {...props} />;
  }

  if (props.question.selection_type === "fill") {
    return <FillQuestion {...props} />;
  }

  if (props.question.selection_type === "true_false") {
    return <TrueFalseQuestion key={props.question.id} question={props.question} disabled={props.hasAnswered} onComplete={props.onComplete} />;
  }

  if (props.question.selection_type === "order") return <OrderQuestion key={props.question.id} question={props.question} disabled={props.hasAnswered} onComplete={props.onComplete} />;
  if (props.question.selection_type === "century") return <CenturyQuestion key={props.question.id} question={props.question} disabled={props.hasAnswered} onComplete={props.onComplete} />;
  if (props.question.selection_type === "matching") return <MatchingQuestion key={props.question.id} question={props.question} disabled={props.hasAnswered} onComplete={props.onComplete} />;
  if (props.question.selection_type === "llm") return <LlmQuestion key={props.question.id} question={props.question} disabled={props.hasAnswered} onComplete={props.onComplete} />;
  if (props.question.selection_type === "map") return <MapQuestion key={props.question.id} question={props.question} disabled={props.hasAnswered} onComplete={props.onComplete} />;
  if (props.question.selection_type === "hotspot") return <HotspotQuestion key={props.question.id} question={props.question} disabled={props.hasAnswered} onComplete={props.onComplete} />;

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
            className={`answer-btn ${selected ? "selected" : ""} ${resultClass}`}
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
            className="open-answer-slot-input"
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

function FillQuestion({ question, fillAnswers, hasAnswered, onFillAnswerChange, onSubmitOpen }: QuestionRendererProps) {
  const blankById = new Map(question.fill_blanks.map((blank, index) => [blank.id, { blank, index }]));
  const parts = question.text.split(/(\{\{[a-z0-9][a-z0-9_-]*\}\})/gi);

  return (
    <div className="fill-text" aria-label="Tekst z lukami">
      {parts.map((part, partIndex) => {
        const match = /^\{\{([a-z0-9][a-z0-9_-]*)\}\}$/i.exec(part);
        if (!match) return <span key={partIndex}>{part}</span>;

        const entry = blankById.get(match[1]);
        if (!entry) return <span key={partIndex}>{part}</span>;
        const { blank, index } = entry;

        if (question.fill_mode === "select") {
          return (
            <select
              aria-label={`Luka ${index + 1}`}
              className="fill-blank-select"
              disabled={hasAnswered}
              key={blank.id}
              value={fillAnswers[index] ?? ""}
              onChange={(event) => onFillAnswerChange(index, event.target.value)}
            >
              <option value="">Wybierz…</option>
              {blank.options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          );
        }

        return (
          <input
            aria-label={`Luka ${index + 1}`}
            className="fill-blank-input"
            disabled={hasAnswered}
            key={blank.id}
            type="text"
            value={fillAnswers[index] ?? ""}
            onChange={(event) => onFillAnswerChange(index, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmitOpen();
              }
            }}
          />
        );
      })}
    </div>
  );
}

function QuestionContext({ question }: { question: QuizQuestion }) {
  const contextText = question.context?.text ?? question.source_text;
  if (!contextText) return null;

  return (
    <div className="question-source">
      <p>{contextText}</p>
      {question.context?.source && <p>Źródło: {question.context.source}</p>}
    </div>
  );
}

function QuestionImage({ question }: { question: QuizQuestion }) {
  if (!question.image) return null;
  const imageUrl = question.image.startsWith("http") ? question.image : `${window.CONFIG?.API_BASE_URL ?? ""}${question.image}`;

  return <div className="question-image-wrapper"><img className="question-image" src={imageUrl} alt="Obrazek do pytania" /></div>;
}

function AnimatedProgressBar({ progress }: { progress: number }) {
  const scaleX = useSpring(progress / 100, {
    stiffness: 180,
    damping: 28,
    mass: 0.4,
  });

  useEffect(() => {
    scaleX.set(progress / 100);
  }, [progress, scaleX]);

  return (
    <div
      className="question-progress-track"
      aria-label="Postęp quizu"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
    >
      <motion.div className="question-progress-bar" style={{ scaleX, transformOrigin: "left" }} />
    </div>
  );
}

function FeedbackPanel({ feedback }: { feedback: QuizFeedback }) {
  const explanation = feedback.explanation.trim();
  if (!feedback.isCorrect && !explanation) return null;

  const message = feedback.isCorrect ? "Dobrze" : explanation;

  return (
    <motion.p
      className={`feedback animated-feedback ${feedback.isCorrect ? "correct-feedback" : "incorrect-feedback"}`}
      initial={feedback.isCorrect ? { scale: 0.92, opacity: 0 } : { x: 0, opacity: 0 }}
      animate={feedback.isCorrect ? { scale: 1, opacity: 1 } : { x: [0, -4, 4, -2, 2, 0], opacity: 1 }}
      transition={feedback.isCorrect ? { type: "spring", stiffness: 400, damping: 20 } : { duration: 0.28 }}
    >
      {feedback.isCorrect && <span className="feedback-icon" aria-hidden="true">✓</span>}
      <span className="feedback-body">
        <span>{message}</span>
        {feedback.maximumPoints > 1 && <span className="feedback-points">Zdobyte punkty: {feedback.earnedPoints} / {feedback.maximumPoints}</span>}
      </span>
    </motion.p>
  );
}

function ResultScreen({ quiz, score, section, onRestart }: { quiz: Quiz; score: number; section: string; onRestart: () => void }) {
  const maximum = getQuizMaxPoints(quiz);
  const percentage = getScorePercentage(score, maximum);
  const sectionTitle = section === "geography" ? "Quizy z geografii" : section === "biology" ? "Quizy z biologii" : "Quizy z historii";
  const celebrationStartedRef = useRef(false);
  const [percentageCountComplete, setPercentageCountComplete] = useState(false);
  const isPerfectScore = maximum > 0 && score === maximum;
  const showFinalCelebration = !isPerfectScore || percentageCountComplete;

  const handlePercentageComplete = useCallback(() => {
    setPercentageCountComplete(true);
  }, []);

  useEffect(() => {
    if (!isPerfectScore || !percentageCountComplete || celebrationStartedRef.current) return;

    celebrationStartedRef.current = true;
    const endTime = Date.now() + 2800;
    const launchConfetti = () => {
      confetti({
        particleCount: 20,
        angle: 270,
        spread: 115,
        startVelocity: 24,
        gravity: 0.55,
        scalar: 1.5,
        ticks: 350,
        colors: ["#168782", "#f0b848", "#f27163", "#5c9edb", "#9b7bce"],
        origin: { x: 0.1 + Math.random() * 0.8, y: 0 },
      });
    };

    launchConfetti();
    const interval = window.setInterval(() => {
      if (Date.now() >= endTime) {
        window.clearInterval(interval);
        return;
      }
      launchConfetti();
    }, 120);

    return () => window.clearInterval(interval);
  }, [isPerfectScore, percentageCountComplete]);

  return (
    <main className="container quiz-play-shell">
      <motion.section
        className="question-card result-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }}
      >
        <motion.div
          className="result-emoji"
          aria-hidden="true"
          initial={false}
          animate={{ scale: showFinalCelebration ? 1 : 0.9, opacity: showFinalCelebration ? 1 : 0.2 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
        >
          {showFinalCelebration ? getFinalEmoji(percentage) : "🏆"}
        </motion.div>
        <h2>Koniec quizu</h2>
        <div className="result-grid">
          <ResultTile label="Wynik" value={`${score} / ${maximum} pkt`} />
          <ResultTile label="Procent" value={<AnimatedPercentage value={percentage} onComplete={handlePercentageComplete} />} />
          <ResultTile label="Ocena" value={getFinalGrade(score, maximum)} />
          <ResultTile label="Komunikat" value={getFinalMessage(score, maximum)} wide />
        </div>
        <div className="result-actions">
          <button id="restart-button" type="button" onClick={onRestart}>Zagraj jeszcze raz</button>
          <a className="result-list-tile" href={`${section}.html`}>
            <span className="result-list-icon" aria-hidden="true">←</span>
            <span><span className="result-list-title">{sectionTitle}</span><span className="result-list-subtitle">Wybierz inny zestaw</span></span>
          </a>
        </div>
      </motion.section>
    </main>
  );
}

function playPerfectScoreAudio() {
  const audio = new Audio(PERFECT_SCORE_AUDIO_URL);
  audio.preload = "auto";
  void audio.play().catch(() => undefined);
}

function ResultTile({ label, value, wide = false }: { label: string; value: ReactNode; wide?: boolean }) {
  return <div className={`result-tile${wide ? " result-tile-wide" : ""}`}><div className="result-label">{label}</div><div className="result-value">{value}</div></div>;
}

function AnimatedPercentage({ value, onComplete }: { value: number; onComplete: () => void }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    setDisplayValue(0);
    const controls = animate(0, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (latest) => setDisplayValue(Math.round(latest)),
      onComplete,
    });

    return () => controls.stop();
  }, [value, onComplete]);

  return <span className="animated-percentage">{displayValue}%</span>;
}

function getFinalEmoji(percentage: number): string {
  if (percentage < 50) return "📚";
  if (percentage < 75) return "🙂";
  if (percentage < 90) return "👏";
  if (percentage < 100) return "🎉";
  return "🏆";
}

function shuffleChoices(choices: AnswerChoice[]): AnswerChoice[] {
  const shuffled = [...choices];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}
