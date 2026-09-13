import { getRuntimeConfig } from "../runtime-config";

export interface QuizListItem {
  id: string;
  title: string;
  description: string;
  category: string;
  age_group: string;
}

export async function getQuizzes(signal?: AbortSignal): Promise<QuizListItem[]> {
  const { API_BASE_URL } = getRuntimeConfig();
  const response = await fetch(`${API_BASE_URL}/api/quizzes`, { signal });

  if (!response.ok) {
    throw new Error("Nie udało się załadować listy quizów.");
  }

  return response.json() as Promise<QuizListItem[]>;
}
