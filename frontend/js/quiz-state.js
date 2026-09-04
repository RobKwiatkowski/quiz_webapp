// SECTION: quiz-state
// Shared runtime state for the quiz session.
let currentQuiz = null;
let currentQuestionIndex = 0;
let earnedPoints = 0;
let maxPoints = 0;
let hasAnswered = false;

function getCurrentQuestion() {
  return currentQuiz.questions[currentQuestionIndex];
}

function resetQuizState() {
  currentQuestionIndex = 0;
  earnedPoints = 0;
  maxPoints = 0;
  hasAnswered = false;
}

function getQuestionMaxPoints(question) {
  if (question.selection_type === "open" && Array.isArray(question.answer_slots)) {
    return Math.max(question.answer_slots.length, 1);
  }

  return 1;
}

function getQuizMaxPoints(quiz) {
  return (quiz.questions || []).reduce(
    (total, question) => total + getQuestionMaxPoints(question),
    0
  );
}
