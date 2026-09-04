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
  const inputEls = getOpenAnswerInputs();
  const rawValues = inputEls.map((inputEl) => inputEl.value.trim());

  if (rawValues.every((value) => !value)) {
    showOpenAnswerRequiredMessage();
    return;
  }

  hasAnswered = true;

  const points = getOpenAnswerPoints(question, rawValues);
  const maximum = getQuestionMaxPoints(question);
  const isCorrectOverall = points === maximum;

  earnedPoints += points;

  inputEls.forEach((inputEl) => {
    inputEl.disabled = true;
  });
  showFeedback(isCorrectOverall, question.explanation || "", points, maximum);
}

function getOpenAnswerInputs() {
  const slotInputs = Array.from(document.querySelectorAll(".open-answer-slot-input"));
  if (slotInputs.length > 0) {
    return slotInputs;
  }
  return [document.getElementById("open-answer-input")];
}

function getOpenAnswerPoints(question, rawValues) {
  if (Array.isArray(question.answer_slots) && question.answer_slots.length > 0) {
    return getMultiSlotOpenAnswerPoints(question, rawValues);
  }

  const userAnswer = normalizeOpenValue(question, rawValues[0] || "");
  const acceptedAnswers = (question.accepted_answers || []).map((answer) =>
    normalizeOpenValue(question, answer)
  );
  return acceptedAnswers.includes(userAnswer) ? 1 : 0;
}

function getMultiSlotOpenAnswerPoints(question, rawValues) {
  const unmatchedSlots = (question.answer_slots || []).map((slot) =>
    (slot.accepted_answers || []).map((answer) => normalizeOpenValue(question, answer))
  );
  const userAnswers = rawValues
    .filter(Boolean)
    .map((answer) => normalizeOpenValue(question, answer));

  let points = 0;

  userAnswers.forEach((userAnswer) => {
    const slotIndex = unmatchedSlots.findIndex((acceptedAnswers) =>
      acceptedAnswers.includes(userAnswer)
    );

    if (slotIndex >= 0) {
      points += 1;
      unmatchedSlots.splice(slotIndex, 1);
    }
  });

  return points;
}

function normalizeOpenValue(question, value) {
  return question.case_sensitive
    ? normalizeAnswerWhitespace(value)
    : normalizeAnswer(value);
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
    const llmPoints = Math.max(0, Math.min(Number(evaluation.points) || 0, 1));
    const isCorrectOverall = llmPoints === 1;

    hasAnswered = true;
    earnedPoints += llmPoints;
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
    earnedPoints += 1;
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
    earnedPoints += 1;
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
    earnedPoints += 1;
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
    earnedPoints += 1;
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
  const feedbackParts = parseLlmFeedback(evaluation.feedback);

  feedbackEl.replaceChildren(createLlmFeedbackContent(feedbackParts, llmPoints));
  feedbackEl.className = isCorrectOverall
    ? "feedback correct-feedback llm-feedback"
    : "feedback incorrect-feedback llm-feedback";
  feedbackEl.classList.remove("hidden");
  showElement("next-button");
  hideElement("check-button");
}

function parseLlmFeedback(rawFeedback) {
  const withoutPoints = (rawFeedback || "Odpowiedź została sprawdzona.")
    .replace(/\s*Punkty:\s*\d+(?:[.,]\d+)?\s*\/\s*1\s*$/i, "")
    .replace(/\\+$/g, "")
    .trim();
  const correctAnswerMatch = withoutPoints.match(/^(.*?)[;.]?\s*poprawnie:\s*(.+)$/i);

  if (!correctAnswerMatch) {
    return {message: withoutPoints, correctAnswer: ""};
  }

  return {
    message: correctAnswerMatch[1].trim() || "Odpowiedź wymaga poprawy.",
    correctAnswer: correctAnswerMatch[2].trim()
  };
}

function createLlmFeedbackContent(feedbackParts, llmPoints) {
  const contentEl = document.createElement("div");
  contentEl.className = "llm-feedback-content";

  const messageEl = document.createElement("p");
  messageEl.className = "llm-feedback-message";
  messageEl.textContent = feedbackParts.message;
  contentEl.appendChild(messageEl);

  if (feedbackParts.correctAnswer) {
    const answerBlockEl = document.createElement("div");
    answerBlockEl.className = "llm-correct-answer";

    const labelEl = document.createElement("div");
    labelEl.className = "llm-correct-answer-label";
    labelEl.textContent = "Poprawnie:";

    const textEl = document.createElement("p");
    textEl.className = "llm-correct-answer-text";
    textEl.textContent = feedbackParts.correctAnswer;

    answerBlockEl.append(labelEl, textEl);
    contentEl.appendChild(answerBlockEl);
  }

  const pointsEl = document.createElement("div");
  pointsEl.className = "llm-points-badge";
  pointsEl.textContent = `Punkty: ${llmPoints} / 1`;
  contentEl.appendChild(pointsEl);

  return contentEl;
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


