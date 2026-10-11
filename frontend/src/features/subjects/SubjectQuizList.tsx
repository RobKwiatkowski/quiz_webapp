import { useEffect, useState } from "react";
import { getQuizzes, type QuizDifficulty, type QuizListItem } from "../../api/quiz-api";
import {
  filterQuizzesForSubject,
  filterQuizzesForGrade,
  getChapterLabel,
  type GradeConfig,
  type SubjectConfig,
} from "./subject-config";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; quizzes: QuizListItem[] }
  | { status: "error"; message: string };

interface SubjectQuizListProps {
  subject: SubjectConfig;
  grade?: GradeConfig;
}

export function SubjectQuizList({ subject, grade }: SubjectQuizListProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setLoadState({ status: "loading" });

    getQuizzes(controller.signal)
      .then((quizzes) => {
        setLoadState({
          status: "ready",
          quizzes: grade
            ? filterQuizzesForGrade(filterQuizzesForSubject(quizzes, subject), grade)
            : filterQuizzesForSubject(quizzes, subject),
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setLoadState({
          status: "error",
          message: error instanceof Error ? error.message : "Nieznany błąd.",
        });
      });

    return () => controller.abort();
  }, [subject, grade]);

  if (loadState.status === "loading") {
    return <p className="subject-status">Ładowanie quizów...</p>;
  }

  if (loadState.status === "error") {
    return <p className="subject-status subject-status-error">Błąd: {loadState.message}</p>;
  }

  if (loadState.quizzes.length === 0) {
    return <p className="subject-status">{grade ? `Brak dostępnych quizów dla ${grade.label.toLowerCase()}.` : subject.emptyText}</p>;
  }

  return (
    <div className="quiz-list subject-quiz-grid">
      {loadState.quizzes.map((quiz) => (
        <QuizCard key={quiz.id} quiz={quiz} subjectId={subject.id} />
      ))}
    </div>
  );
}

interface QuizCardProps {
  quiz: QuizListItem;
  subjectId: SubjectConfig["id"];
}

function QuizCard({ quiz, subjectId }: QuizCardProps) {
  const difficultyLevels = quiz.difficulty_levels ?? [];
  const [difficulty, setDifficulty] = useState<QuizDifficulty>(difficultyLevels[0] ?? "easy");
  const chapterLabel = getChapterLabel(quiz);
  const supportsDifficulty = difficultyLevels.length > 0;
  const difficultyQuery = supportsDifficulty ? `&difficulty=${difficulty}` : "";
  const quizUrl = `quiz.html?id=${encodeURIComponent(quiz.id)}&section=${encodeURIComponent(subjectId)}${difficultyQuery}`;

  return (
    <article className="quiz-card">
      <span className="quiz-card-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
        </svg>
      </span>
      <div className="quiz-card-content">
        {chapterLabel && <span className="chapter-label">{chapterLabel}</span>}
        <h2>{quiz.title}</h2>
        <p>{quiz.description}</p>
      </div>
      {supportsDifficulty && (
        <fieldset className="quiz-card-difficulty">
          <legend>Poziom trudności</legend>
          <div className="quiz-card-difficulty-options">
            {([
              ["easy", "Łatwy"],
              ["medium", "Średni"],
              ["pro", "Pro"],
            ] as const).filter(([value]) => difficultyLevels.includes(value)).map(([value, label]) => (
              <button
                aria-pressed={difficulty === value}
                key={value}
                onClick={() => setDifficulty(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <a className="quiz-start-button" href={quizUrl}>
        Rozpocznij quiz <span aria-hidden="true">→</span>
      </a>
    </article>
  );
}
