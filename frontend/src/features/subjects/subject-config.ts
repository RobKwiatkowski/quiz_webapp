import type { QuizListItem } from "../../api/quiz-api";

export type SubjectId = "history" | "geography" | "biology" | "polish" | "english" | "german" | "math" | "physics" | "chemistry";

export interface SubjectConfig {
  id: SubjectId;
  title: string;
  description: string;
  emptyText: string;
  categories: readonly string[];
  grades?: readonly GradeConfig[];
}

export interface GradeConfig {
  id: "4" | "5" | "6" | "7";
  label: string;
  color: "blue" | "green" | "yellow" | "red";
  quizIds: readonly string[];
}

export const subjectConfigs: Record<SubjectId, SubjectConfig> = {
  history: {
    id: "history",
    title: "Historia",
    description: "Poznaj wydarzenia, które zmieniły świat. Wybierz temat i sprawdź, co już wiesz.",
    emptyText: "Brak dostępnych quizów z historii.",
    categories: ["history", "llm"],
    grades: [
      {
        id: "4",
        label: "Klasa IV",
        color: "blue",
        quizIds: ["history-chapter-6"],
      },
      {
        id: "5",
        label: "Klasa V",
        color: "green",
        quizIds: ["history-liczenie-wiekow", "history-pierwsze-cywilizacje"],
      },
      {
        id: "6",
        label: "Klasa VI",
        color: "yellow",
        quizIds: [
          "history-konfederacja-upadek-rzeczypospolitej",
          "history-napoleon-rewolucja-francuska",
        ],
      },
      {
        id: "7",
        label: "Klasa VII",
        color: "red",
        quizIds: ["europa-po-kongresie-wiedenskim", "ziemie-polskie-po-kongresie-wiedenskim"],
      },
    ],
  },
  geography: {
    id: "geography",
    title: "Geografia",
    description: "Wybierz quiz i rozpocznij naukę.",
    emptyText: "Brak dostępnych quizów z geografii.",
    categories: ["geography"],
  },
  biology: {
    id: "biology",
    title: "Biologia",
    description: "Wybierz quiz i rozpocznij naukę.",
    emptyText: "Brak dostępnych quizów z biologii.",
    categories: ["biology"],
  },
  polish: {
    id: "polish",
    title: "Język polski",
    description: "Powtarzaj lektury, bohaterów i najważniejsze wydarzenia.",
    emptyText: "Brak dostępnych quizów z języka polskiego.",
    categories: ["polish"],
  },
  english: {
    id: "english",
    title: "Język angielski",
    description: "Ćwicz gramatykę i słownictwo w krótkich, przejrzystych zadaniach.",
    emptyText: "Brak dostępnych quizów z języka angielskiego.",
    categories: ["english"],
  },
  german: {
    id: "german",
    title: "Język niemiecki",
    description: "Ćwicz słownictwo, liczebniki i podstawową gramatykę w języku niemieckim.",
    emptyText: "Brak dostępnych quizów z języka niemieckiego.",
    categories: ["german"],
  },
  math: {
    id: "math",
    title: "Matematyka",
    description: "Ćwicz rachunki i poznawaj sposoby rozwiązywania zadań krok po kroku.",
    emptyText: "Brak dostępnych quizów z matematyki.",
    categories: ["math"],
  },
  physics: {
    id: "physics",
    title: "Fizyka",
    description: "Poznawaj ruch, prędkość i zjawiska fizyczne w krótkich zadaniach.",
    emptyText: "Brak dostępnych quizów z fizyki.",
    categories: ["physics"],
  },
  chemistry: {
    id: "chemistry",
    title: "Chemia",
    description: "Poznaj substancje, ich właściwości i przemiany w krótkich zadaniach.",
    emptyText: "Brak dostępnych quizów z chemii.",
    categories: ["chemistry"],
  },
};

export function getSubjectFromPath(pathname: string): SubjectId | null {
  const pageName = pathname.split("/").pop()?.replace(/\.html$/i, "") ?? "";

  return pageName in subjectConfigs ? (pageName as SubjectId) : null;
}

export function filterQuizzesForSubject(
  quizzes: QuizListItem[],
  subject: SubjectConfig,
): QuizListItem[] {
  return quizzes.filter((quiz) => subject.categories.includes(quiz.category));
}

export function filterQuizzesForGrade(
  quizzes: QuizListItem[],
  grade: GradeConfig,
): QuizListItem[] {
  const quizzesById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
  return grade.quizIds.flatMap((quizId) => {
    const quiz = quizzesById.get(quizId);
    return quiz ? [quiz] : [];
  });
}

export function getChapterLabel(quiz: QuizListItem): string | null {
  return quiz.chapter_number ? `Rozdział ${quiz.chapter_number}` : null;
}
