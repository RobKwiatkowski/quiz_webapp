import type { QuizListItem } from "../../api/quiz-api";

export type SubjectId = "history" | "geography" | "biology";

export interface SubjectConfig {
  id: SubjectId;
  title: string;
  description: string;
  emptyText: string;
  categories: readonly string[];
}

export const subjectConfigs: Record<SubjectId, SubjectConfig> = {
  history: {
    id: "history",
    title: "Historia",
    description: "Poznaj wydarzenia, które zmieniły świat. Wybierz temat i sprawdź, co już wiesz.",
    emptyText: "Brak dostępnych quizów z historii.",
    categories: ["history", "llm"],
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

export function getChapterLabel(quiz: QuizListItem): string | null {
  const source = `${quiz.id} ${quiz.title} ${quiz.description}`;
  const match = source.match(/(?:chapter|rozdzia[lł])[-\s:]*(\d+)/i);

  return match ? `Rozdział ${match[1]}` : null;
}
