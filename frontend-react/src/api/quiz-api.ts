import { getRuntimeConfig } from "../runtime-config";

export interface QuizListItem {
  id: string;
  title: string;
  description: string;
  category: string;
  age_group: string;
}

export type SelectionType =
  | "single"
  | "multiple"
  | "open"
  | "llm"
  | "order"
  | "matching"
  | "map"
  | "hotspot";

export interface Answer {
  text: string;
  is_correct: boolean;
}

export interface AnswerSlot {
  accepted_answers: string[];
}

export interface QuestionContext {
  text: string;
  source?: string | null;
}

export interface QuizQuestion {
  id: string;
  text: string;
  source_text?: string | null;
  context?: QuestionContext | null;
  image?: string | null;
  explanation?: string | null;
  selection_type: SelectionType;
  answers: Answer[];
  accepted_answers: string[];
  answer_slots: AnswerSlot[];
  case_sensitive?: boolean;
}

export interface Quiz extends QuizListItem {
  questions: QuizQuestion[];
}

export async function getQuizzes(signal?: AbortSignal): Promise<QuizListItem[]> {
  const { API_BASE_URL } = getRuntimeConfig();
  const response = await fetch(`${API_BASE_URL}/api/quizzes`, { signal });

  if (!response.ok) {
    throw new Error("Nie udało się załadować listy quizów.");
  }

  return response.json() as Promise<QuizListItem[]>;
}

export async function getQuizById(quizId: string, signal?: AbortSignal): Promise<Quiz> {
  const { API_BASE_URL } = getRuntimeConfig();
  const response = await fetch(`${API_BASE_URL}/api/quizzes/${encodeURIComponent(quizId)}`, { signal });

  if (!response.ok) {
    throw new Error("Nie udało się załadować quizu.");
  }

  return response.json() as Promise<Quiz>;
}
