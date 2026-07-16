// SECTION: quiz-question-type-utils
// Helpers for question type detection and answer normalization.
function isOpenQuestion(question) {
  return question.selection_type === "open";
}

function isLlmQuestion(question) {
  return question.selection_type === "llm";
}

function isOrderQuestion(question) {
  return question.selection_type === "order";
}

function isMatchingQuestion(question) {
  return question.selection_type === "matching";
}

function normalizeAnswerWhitespace(value) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeAnswer(value) {
  const polishCharsMap = {
    "\u0105": "a",
    "\u0107": "c",
    "\u0119": "e",
    "\u0142": "l",
    "\u0144": "n",
    "\u00f3": "o",
    "\u015b": "s",
    "\u017a": "z",
    "\u017c": "z"
  };

  return normalizeAnswerWhitespace(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+$/gu, "")
    .replace(/[\u0105\u0107\u0119\u0142\u0144\u00f3\u015b\u017a\u017c]/g, (char) => polishCharsMap[char] || char);
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
    return;
  }

  if (question.selection_type === "llm") {
    handleCheckLlmAnswer();
    return;
  }

  if (question.selection_type === "order") {
    handleCheckOrderAnswer();
    return;
  }

  if (question.selection_type === "matching") {
    handleCheckMatchingAnswer();
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
    showOpenAnswerRequiredMessage();
    return;
  }

  hasAnswered = true;

  const userAnswer = question.case_sensitive
    ? normalizeAnswerWhitespace(rawValue)
    : normalizeAnswer(rawValue);

  const acceptedAnswers = (question.accepted_answers || []).map((answer) =>
    question.case_sensitive ? normalizeAnswerWhitespace(answer) : normalizeAnswer(answer)
  );

  const isCorrectOverall = acceptedAnswers.includes(userAnswer);

  if (isCorrectOverall) {
    score += 1;
  }

  inputEl.disabled = true;
  showFeedback(isCorrectOverall, question.explanation || "");
}

// SECTION: quiz-llm-answer-check
// Sends free-text answers to the LLM evaluation service.
async function handleCheckLlmAnswer() {
  if (hasAnswered) return;

  const question = getCurrentQuestion();
  const inputEl = document.getElementById("open-answer-input");
  const checkButton = document.getElementById("check-button");
  const rawValue = inputEl.value.trim();

  if (!rawValue) {
    showOpenAnswerRequiredMessage();
    return;
  }

  checkButton.disabled = true;
  showCheckingAnswerMessage();

  try {
    const evaluation = await checkAnswerWithLlm(question, rawValue);
    const llmPoints = Math.max(0, Math.min(Number(evaluation.points) || 0, 2));
    const quizPoints = llmPoints / 2;
    const isCorrectOverall = llmPoints === 2;

    hasAnswered = true;
    score += quizPoints;
    inputEl.disabled = true;
    showLlmFeedback(evaluation, isCorrectOverall, llmPoints);
  } catch (error) {
    console.error(error);
    showLlmErrorMessage();
  } finally {
    checkButton.disabled = false;
  }
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

// SECTION: quiz-order-answer-check
// Deferred validation for sequence questions after user clicks "Check".
function handleCheckOrderAnswer() {
  if (hasAnswered) return;

  const question = getCurrentQuestion();
  const orderedItemIds = Array.from(document.querySelectorAll(".order-item"))
    .map((item) => item.dataset.orderItemId);

  const correctItemIds = [...(question.order_items || [])]
    .sort((a, b) => a.position - b.position)
    .map((item) => item.id);

  const isCorrectOverall =
    orderedItemIds.length === correctItemIds.length &&
    orderedItemIds.every((itemId, index) => itemId === correctItemIds[index]);

  hasAnswered = true;

  if (isCorrectOverall) {
    score += 1;
  }

  showOrderItemStates(isCorrectOverall);
  lockOrderItems();
  showFeedback(isCorrectOverall, question.explanation);
}

// SECTION: quiz-matching-answer-check
// Deferred validation for matching questions after user clicks "Check".
function handleCheckMatchingAnswer() {
  if (hasAnswered) return;

  const question = getCurrentQuestion();
  const matchingSelects = Array.from(document.querySelectorAll(".matching-select"));
  const hasEmptyMatch = matchingSelects.some((select) => select.value === "");

  if (hasEmptyMatch) {
    showMatchingAnswerRequiredMessage();
    return;
  }

  const isCorrectOverall = matchingSelects.every(
    (select) => select.value === select.dataset.correctRight
  );

  hasAnswered = true;

  if (isCorrectOverall) {
    score += 1;
  }

  showMatchingPairStates();
  lockMatchingPairs();
  showFeedback(isCorrectOverall, question.explanation);
}

function getScorePercentage(currentScore, totalQuestions) {
  if (totalQuestions === 0) {
    return 0;
  }

  return Math.round((currentScore / totalQuestions) * 100);
}

function getFinalGrade(currentScore, totalQuestions) {
  if (totalQuestions === 0) {
    return "";
  }

  const percentage = getScorePercentage(currentScore, totalQuestions);

  if (percentage < 30) {
    return "1";
  }

  if (percentage <= 50) {
    return "2";
  }

  if (percentage <= 75) {
    return "3";
  }

  if (percentage < 90) {
    return "4";
  }

  if (percentage <= 99) {
    return "5";
  }

  return "6";
}

function showOpenAnswerRequiredMessage() {
  const feedbackEl = document.getElementById("feedback");
  feedbackEl.textContent = "Wpisz odpowied\u017a.";
  feedbackEl.className = "feedback warning-feedback";
  feedbackEl.classList.remove("hidden");
}

function showCheckingAnswerMessage() {
  const feedbackEl = document.getElementById("feedback");
  feedbackEl.textContent = "Sprawdzam odpowiedź...";
  feedbackEl.className = "feedback warning-feedback";
  feedbackEl.classList.remove("hidden");
}

function showLlmErrorMessage() {
  const feedbackEl = document.getElementById("feedback");
  feedbackEl.textContent = "Nie udało się sprawdzić odpowiedzi przez LLM.";
  feedbackEl.className = "feedback incorrect-feedback";
  feedbackEl.classList.remove("hidden");
}

function showLlmFeedback(evaluation, isCorrectOverall, llmPoints) {
  const feedbackEl = document.getElementById("feedback");
  const feedback = evaluation.feedback || "Odpowiedź została sprawdzona.";
  feedbackEl.textContent = `${feedback} Punkty: ${llmPoints}/2`;
  feedbackEl.className = isCorrectOverall
    ? "feedback correct-feedback"
    : "feedback incorrect-feedback";
  feedbackEl.classList.remove("hidden");
  showElement("next-button");
  hideElement("check-button");
}

function showMatchingAnswerRequiredMessage() {
  const feedbackEl = document.getElementById("feedback");
  feedbackEl.textContent = "Dopasuj wszystkie pary.";
  feedbackEl.className = "feedback warning-feedback";
  feedbackEl.classList.remove("hidden");
}

function getFinalMessage(currentScore, totalQuestions) {
  if (totalQuestions === 0) {
    return "";
  }

  const percentage = getScorePercentage(currentScore, totalQuestions);

  if (percentage < 50) {
    return "Niestety, ale musisz jeszcze po\u0107wiczy\u0107";
  }

  if (percentage < 75) {
    return "Nie\u017ale ale mo\u017ce by\u0107 lepiej";
  }

  if (percentage < 90) {
    return "Dobrze";
  }

  if (percentage < 100) {
    return "Bardzo dobrze";
  }

  return "Perfekcyjnie!";
}


