// SECTION: quiz-question-type-utils
// Helpers for question type detection and answer normalization.
function isOpenQuestion(question) {
  return question.selection_type === "open";
}

function normalizeAnswer(value) {
  const polishCharsMap = {
    "ą": "a",
    "ć": "c",
    "ę": "e",
    "ł": "l",
    "ń": "n",
    "ó": "o",
    "ś": "s",
    "ź": "z",
    "ż": "z"
  };

  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+$/gu, "")
    .replace(/[ąćęłńóśźż]/g, (char) => polishCharsMap[char] || char);
}

// SECTION: quiz-check-actions
// Entry point that dispatches validation logic by question type.
function handleCheckAction() {
  const question = getCurrentQuestion();

  if (question.selection_type === "multiple") {
    handleCheckMultipleAnswers();
    return;
  }

  if (question.selection_type === "open") {
    handleCheckOpenAnswer();
  }
}

// SECTION: quiz-open-answer-check
// Validation flow for free-text answers.
function handleCheckOpenAnswer() {
  if (hasAnswered) return;

  const question = getCurrentQuestion();
  const inputEl = document.getElementById("open-answer-input");
  const rawValue = inputEl.value.trim();

  if (!rawValue) {
    return;
  }

  hasAnswered = true;

  const userAnswer = question.case_sensitive
    ? rawValue.trim()
    : normalizeAnswer(rawValue);

  const acceptedAnswers = (question.accepted_answers || []).map((answer) =>
    question.case_sensitive ? answer.trim() : normalizeAnswer(answer)
  );

  const isCorrectOverall = acceptedAnswers.includes(userAnswer);

  if (isCorrectOverall) {
    score += 1;
  }

  inputEl.disabled = true;
  showFeedback(isCorrectOverall, question.explanation);
}

// SECTION: quiz-single-answer-check
// Immediate validation for single-choice questions.
function handleSingleAnswerClick(event) {
  if (hasAnswered) return;

  hasAnswered = true;
  const button = event.currentTarget;
  const question = getCurrentQuestion();
  const isCorrect = button.dataset.correct === "true";

  if (isCorrect) {
    score += 1;
  }

  showCorrectAndIncorrectStates([button]);
  lockAnswers();
  showFeedback(isCorrect, question.explanation);
}

// SECTION: quiz-multiple-answer-check
// Deferred validation for multiple-choice questions after user clicks "Check".
function handleCheckMultipleAnswers() {
  if (hasAnswered) return;

  const question = getCurrentQuestion();
  const selectedButtons = Array.from(document.querySelectorAll(".answer-btn.selected"));

  if (selectedButtons.length === 0) {
    return;
  }

  hasAnswered = true;

  const selectedPattern = selectedButtons.map((btn) => btn.dataset.correct === "true");
  const allSelectedAreCorrect = selectedPattern.every(Boolean);

  const correctButtons = Array.from(document.querySelectorAll('.answer-btn[data-correct="true"]'));
  const selectedCorrectCount = selectedButtons.filter((btn) => btn.dataset.correct === "true").length;
  const allCorrectSelected = selectedCorrectCount === correctButtons.length;

  const isCorrectOverall = allSelectedAreCorrect && allCorrectSelected;

  if (isCorrectOverall) {
    score += 1;
  }

  showCorrectAndIncorrectStates(selectedButtons);
  lockAnswers();
  showFeedback(isCorrectOverall, question.explanation);
}

function getFinalMessage(currentScore, totalQuestions) {
  if (totalQuestions === 0) {
    return "";
  }

  const percentage = (currentScore / totalQuestions) * 100;

  if (percentage < 50) {
    return "Musisz jeszcze poćwiczyć";
  }

  if (percentage < 75) {
    return "Nieźle ale może być lepiej";
  }

  if (percentage < 90) {
    return "Dobrze";
  }

  if (percentage < 100) {
    return "Bardzo dobrze";
  }

  return "Perfekcyjnie!";
}
