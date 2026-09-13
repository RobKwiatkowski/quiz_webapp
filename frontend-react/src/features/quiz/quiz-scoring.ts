import type { Quiz, QuizQuestion } from "../../api/quiz-api";

const polishCharacters: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
};

export function normalizeAnswerWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeOpenAnswer(question: QuizQuestion, value: string): string {
  if (question.case_sensitive) {
    return normalizeAnswerWhitespace(value);
  }

  return normalizeAnswerWhitespace(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+$/gu, "")
    .replace(/[ąćęłńóśźż]/g, (character) => polishCharacters[character] ?? character);
}

export function getQuestionMaxPoints(question: QuizQuestion): number {
  if (question.selection_type === "open" && question.answer_slots.length > 0) {
    return question.answer_slots.length;
  }

  return 1;
}

export function getQuizMaxPoints(quiz: Quiz): number {
  return quiz.questions.reduce((total, question) => total + getQuestionMaxPoints(question), 0);
}

export function getOpenAnswerPoints(question: QuizQuestion, rawValues: string[]): number {
  if (question.answer_slots.length === 0) {
    const userAnswer = normalizeOpenAnswer(question, rawValues[0] ?? "");
    const acceptedAnswers = question.accepted_answers.map((answer) =>
      normalizeOpenAnswer(question, answer),
    );

    return acceptedAnswers.includes(userAnswer) ? 1 : 0;
  }

  const unmatchedSlots = question.answer_slots.map((slot) =>
    slot.accepted_answers.map((answer) => normalizeOpenAnswer(question, answer)),
  );
  const userAnswers = rawValues.filter(Boolean).map((answer) => normalizeOpenAnswer(question, answer));

  let points = 0;
  userAnswers.forEach((userAnswer) => {
    const slotIndex = unmatchedSlots.findIndex((acceptedAnswers) =>
      acceptedAnswers.includes(userAnswer),
    );

    if (slotIndex >= 0) {
      points += 1;
      unmatchedSlots.splice(slotIndex, 1);
    }
  });

  return points;
}

export function getScorePercentage(score: number, maximum: number): number {
  return maximum === 0 ? 0 : Math.round((score / maximum) * 100);
}

export function getFinalGrade(score: number, maximum: number): string {
  const percentage = getScorePercentage(score, maximum);

  if (percentage < 30) return "1";
  if (percentage <= 50) return "2";
  if (percentage <= 75) return "3";
  if (percentage < 90) return "4";
  if (percentage <= 99) return "5";
  return "6";
}

export function getFinalMessage(score: number, maximum: number): string {
  const percentage = getScorePercentage(score, maximum);

  if (percentage < 50) return "Niestety, ale musisz jeszcze poćwiczyć";
  if (percentage < 75) return "Nieźle, ale może być lepiej";
  if (percentage < 90) return "Dobrze";
  if (percentage < 100) return "Bardzo dobrze";
  return "Perfekcyjnie!";
}
