import { useEffect, useState } from "react";
import { getQuizzes, type QuizListItem } from "../../api/quiz-api";
import {
  filterQuizzesForSubject,
  getChapterLabel,
  type SubjectConfig,
} from "./subject-config";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; quizzes: QuizListItem[] }
  | { status: "error"; message: string };

interface SubjectQuizListProps {
  subject: SubjectConfig;
}

export function SubjectQuizList({ subject }: SubjectQuizListProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setLoadState({ status: "loading" });

    getQuizzes(controller.signal)
      .then((quizzes) => {
        setLoadState({
          status: "ready",
          quizzes: filterQuizzesForSubject(quizzes, subject),
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
  }, [subject]);

  if (loadState.status === "loading") {
    return <p className="subject-status">Ładowanie quizów...</p>;
  }

  if (loadState.status === "error") {
    return <p className="subject-status subject-status-error">Błąd: {loadState.message}</p>;
  }

  if (loadState.quizzes.length === 0) {
    return <p className="subject-status">{subject.emptyText}</p>;
  }

  return (
    <>
      <p className="quiz-count">{loadState.quizzes.length} dostępnych quizów</p>
      <div className="quiz-list">
        {loadState.quizzes.map((quiz) => (
          <QuizCard key={quiz.id} quiz={quiz} subjectId={subject.id} />
        ))}
      </div>
    </>
  );
}

interface QuizCardProps {
  quiz: QuizListItem;
  subjectId: SubjectConfig["id"];
}

function QuizCard({ quiz, subjectId }: QuizCardProps) {
  const chapterLabel = getChapterLabel(quiz);
  const quizUrl = `quiz.html?id=${encodeURIComponent(quiz.id)}&section=${encodeURIComponent(subjectId)}`;

  return (
    <article className="quiz-card">
      <div>
        {chapterLabel && <span className="chapter-label">{chapterLabel}</span>}
        <h2>{quiz.title}</h2>
        <p>{quiz.description}</p>
      </div>
      <a className="quiz-start-button" href={quizUrl}>
        Rozpocznij quiz <span aria-hidden="true">→</span>
      </a>
    </article>
  );
}
