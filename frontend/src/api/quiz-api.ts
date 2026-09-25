import { getRuntimeConfig } from "../runtime-config";

export interface QuizListItem {
  id: string;
  title: string;
  description: string;
  category: string;
  age_group: string;
  chapter_number?: number | null;
  difficulty_levels: QuizDifficulty[];
}

export type SelectionType =
  | "single"
  | "multiple"
  | "true_false"
  | "open"
  | "llm"
  | "order"
  | "matching"
  | "map"
  | "hotspot"
  | "century"
  | "fill"
  | "written_multiplication"
  | "written_division"
  | "timed_multiplication"
  | "timed_division"
  | "operation_order";

export interface Answer {
  text: string;
  is_correct: boolean;
}

export interface AnswerSlot {
  accepted_answers: string[];
}

export interface FillBlank {
  id: string;
  accepted_answers: string[];
  options: string[];
}

export interface CenturyConfig {
  min_year: number;
  max_year: number;
}

export interface WrittenMultiplicationConfig {
  min_factor: number;
  max_factor: number;
  max_total_digits: number;
  easy_max_total_digits: number;
  easy_max_partial_product: number;
}

export interface WrittenDivisionConfig {
  min_divisor: number;
  max_divisor: number;
  min_quotient: number;
  max_quotient: number;
  max_dividend_digits: number;
  easy_min_divisor: number;
  easy_max_divisor: number;
  medium_min_divisor: number;
  medium_max_divisor: number;
  easy_max_quotient: number;
  easy_max_dividend_digits: number;
  easy_max_intermediate_value: number;
}

export interface TimedMultiplicationConfig {
  min_factor: number;
  max_factor: number;
  time_limit_seconds: number;
}

export interface TimedDivisionConfig {
  min_divisor: number;
  max_divisor: number;
  min_quotient: number;
  max_quotient: number;
  time_limit_seconds: number;
}

export type OperationOrderFamily = "precedence" | "parentheses" | "powers" | "left_to_right";

export interface OperationOrderConfig {
  family: OperationOrderFamily;
}

export interface OperationOrderChoice {
  id: string;
  text: string;
}

export interface OperationOrderStep {
  expression: string;
  choices: OperationOrderChoice[];
  correct_choice_id: string;
  focus_prefix: string;
  focus: string;
  focus_suffix: string;
  expected_result: number;
  reduced_expression: string;
  rule: string;
}

export interface OrderItem {
  id: string;
  text: string;
  position: number;
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface MapConfig {
  source: string;
  background_source?: string | null;
  mode: "select" | "identify";
  target_feature_id: string;
  interaction?: "region" | "line";
}

export interface HotspotConfig {
  source: string;
  target_hotspot_id: string;
}

export interface QuestionContext {
  text: string;
  source?: string | null;
}

export interface QuizQuestion {
  id: string;
  is_active?: boolean;
  text: string;
  source_text?: string | null;
  context?: QuestionContext | null;
  image?: string | null;
  explanation?: string | null;
  selection_type: SelectionType;
  answers: Answer[];
  accepted_answers: string[];
  answer_slots: AnswerSlot[];
  fill_mode?: "select" | "open" | null;
  fill_blanks: FillBlank[];
  century_config?: CenturyConfig | null;
  century_year?: number | null;
  correct_century?: number | null;
  correct_century_half?: "first" | "second" | null;
  written_multiplication_config?: WrittenMultiplicationConfig | null;
  timed_multiplication_config?: TimedMultiplicationConfig | null;
  timed_division_config?: TimedDivisionConfig | null;
  multiplicand?: number | null;
  multiplier?: number | null;
  written_division_config?: WrittenDivisionConfig | null;
  dividend?: number | null;
  divisor?: number | null;
  quotient?: number | null;
  operation_order_config?: OperationOrderConfig | null;
  operation_order_difficulty?: QuizDifficulty | null;
  operation_order_expression?: string | null;
  operation_order_steps: OperationOrderStep[];
  operation_order_result?: number | null;
  order_items: OrderItem[];
  matching_pairs: MatchingPair[];
  map_config?: MapConfig | null;
  hotspot_config?: HotspotConfig | null;
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

export type QuizDifficulty = "easy" | "medium" | "pro";

export async function getQuizById(quizId: string, signal?: AbortSignal, attempt = 0, difficulty: QuizDifficulty = "easy"): Promise<Quiz> {
  const { API_BASE_URL } = getRuntimeConfig();
  const query = new URLSearchParams({ attempt: String(attempt), difficulty });
  const response = await fetch(`${API_BASE_URL}/api/quizzes/${encodeURIComponent(quizId)}?${query}`, {
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Nie udało się załadować quizu.");
  }

  return response.json() as Promise<Quiz>;
}

export interface LlmEvaluation {
  points: number;
  feedback: string;
}

export async function checkAnswerWithLlm(
  question: QuizQuestion,
  studentAnswer: string,
): Promise<LlmEvaluation> {
  const { LLM_API_BASE_URL } = getRuntimeConfig();
  const response = await fetch(`${LLM_API_BASE_URL}/check-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: question.text,
      correct_answer: question.accepted_answers[0] ?? "",
      student_answer: studentAnswer,
    }),
  });

  if (!response.ok) {
    throw new Error("Nie udało się sprawdzić odpowiedzi przez LLM.");
  }

  return response.json() as Promise<LlmEvaluation>;
}
