// SECTION: quiz-state
// Shared runtime state for the quiz session.
let currentQuiz = null;
let currentQuestionIndex = 0;
let score = 0;
let hasAnswered = false;

function getCurrentQuestion() {
  return currentQuiz.questions[currentQuestionIndex];
}
