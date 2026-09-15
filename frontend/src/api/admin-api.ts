import { getRuntimeConfig } from "../runtime-config";
import type { QuizQuestion, SelectionType } from "./quiz-api";

export interface AdminSubject { id: string; title: string; }
export interface AdminChapter { id: string; title: string; subject: string; chapter_number?: number | null; }
export interface AdminTopic { id: string; title: string; }
export interface AdminQuestion extends QuizQuestion { id: string; }

export type ImageUpload = { filename: string; content_base64: string };
export type AdminQuestionPayload = Partial<QuizQuestion> & {
  selection_type: SelectionType;
  text: string;
  image_upload?: ImageUpload;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { API_BASE_URL } = getRuntimeConfig();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { detail?: string };
    if (response.status === 401) window.location.assign("/admin/login.html");
    throw new Error(payload.detail ?? "Operacja nie powiodła się.");
  }

  return response.json() as Promise<T>;
}

export const adminApi = {
  session: () => request<{ authenticated: boolean }>("/api/admin/me"),
  login: (username: string, password: string) => request<{ status: string }>("/api/admin/login", {
    method: "POST", body: JSON.stringify({ username, password }),
  }),
  logout: () => request<{ status: string }>("/api/admin/logout", { method: "POST" }),
  subjects: () => request<AdminSubject[]>("/api/admin/subjects"),
  chapters: (subject: string) => request<AdminChapter[]>(`/api/admin/chapters?subject=${encodeURIComponent(subject)}`),
  createChapter: (name: string, subject: string) => request<AdminChapter>("/api/admin/chapters", {
    method: "POST", body: JSON.stringify({ name, subject }),
  }),
  updateChapterNumber: (chapterId: string, chapterNumber: number | null) => request<AdminChapter>(`/api/admin/chapters/${encodeURIComponent(chapterId)}/chapter-number`, {
    method: "PUT", body: JSON.stringify({ chapter_number: chapterNumber }),
  }),
  topics: (chapterId: string) => request<AdminTopic[]>(`/api/admin/chapters/${encodeURIComponent(chapterId)}/topics`),
  createTopic: (chapterId: string, name: string) => request<AdminTopic>(`/api/admin/chapters/${encodeURIComponent(chapterId)}/topics`, {
    method: "POST", body: JSON.stringify({ name }),
  }),
  questions: (chapterId: string, topicId: string) => request<AdminQuestion[]>(`/api/admin/chapters/${encodeURIComponent(chapterId)}/topics/${encodeURIComponent(topicId)}/questions`),
  createQuestion: (chapterId: string, topicId: string, payload: AdminQuestionPayload) => request<AdminQuestion>(`/api/admin/chapters/${encodeURIComponent(chapterId)}/topics/${encodeURIComponent(topicId)}/questions`, {
    method: "POST", body: JSON.stringify(payload),
  }),
  updateQuestion: (chapterId: string, topicId: string, questionId: string, payload: AdminQuestionPayload) => request<AdminQuestion>(`/api/admin/chapters/${encodeURIComponent(chapterId)}/topics/${encodeURIComponent(topicId)}/questions/${encodeURIComponent(questionId)}`, {
    method: "PUT", body: JSON.stringify(payload),
  }),
  deleteQuestion: (chapterId: string, topicId: string, questionId: string) => request<{ status: string }>(`/api/admin/chapters/${encodeURIComponent(chapterId)}/topics/${encodeURIComponent(topicId)}/questions/${encodeURIComponent(questionId)}`, {
    method: "DELETE",
  }),
};
