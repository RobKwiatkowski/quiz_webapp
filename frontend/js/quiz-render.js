// SECTION: quiz-dom-visibility-utils
// Small DOM visibility wrappers used across render and feedback flows.
function showElement(elementId) {
  document.getElementById(elementId).classList.remove("hidden");
}

function hideElement(elementId) {
  document.getElementById(elementId).classList.add("hidden");
}

// SECTION: quiz-rendering
// Renders one question screen with answers/image and resets interaction state.
function renderQuestion() {
  const question = getCurrentQuestion();
  const answersEl = document.getElementById("answers");
  const openAnswerInputEl = document.getElementById("open-answer-input");
  const imageEl = document.getElementById("question-image");
  const imageWrapperEl = document.getElementById("question-image-wrapper");
  const questionProgressTrackEl = document.getElementById("question-progress-track");
  const questionProgressBarEl = document.getElementById("question-progress-bar");
  const questionProgressPercentEl = document.getElementById("question-progress-percent");
  const questionHintEl = document.getElementById("question-hint");
  const questionSourceEl = document.getElementById("question-source");

  showElement("quiz-screen");
  hideElement("result-screen");
  hideElement("status");

  hasAnswered = false;

  const questionPosition = currentQuestionIndex + 1;
  const questionTotal = currentQuiz.questions.length;
  const questionProgressPercent = getQuestionProgressPercentage(questionPosition, questionTotal);

  document.getElementById("question-counter").textContent =
    `Pytanie ${questionPosition} z ${questionTotal}`;

  if (questionProgressTrackEl) {
    questionProgressTrackEl.setAttribute("aria-valuenow", String(questionProgressPercent));
  }

  if (questionProgressBarEl) {
    questionProgressBarEl.style.width = `${questionProgressPercent}%`;
  }

  if (questionProgressPercentEl) {
    questionProgressPercentEl.textContent = `${questionProgressPercent}%`;
  }

  document.getElementById("question-text").textContent = question.text;

  const questionHint = getQuestionHint(question);
  if (questionHintEl) {
    if (questionHint) {
      questionHintEl.textContent = questionHint;
      questionHintEl.classList.remove("hidden");
    } else {
      questionHintEl.textContent = "";
      questionHintEl.classList.add("hidden");
    }
  }

  if (questionSourceEl) {
    if (question.source_text) {
      questionSourceEl.textContent = question.source_text;
      questionSourceEl.classList.remove("hidden");
    } else {
      questionSourceEl.textContent = "";
      questionSourceEl.classList.add("hidden");
    }
  }

  if (question.image) {
    const isRemoteImage =
      question.image.startsWith("http://") || question.image.startsWith("https://");

    imageEl.src = isRemoteImage
      ? question.image
      : `${CONFIG.API_BASE_URL}${question.image}`;

    imageEl.onerror = () => {
      imageEl.removeAttribute("src");
      imageEl.classList.add("hidden");
      imageWrapperEl.classList.add("hidden");
    };

    imageWrapperEl.classList.remove("hidden");
    imageEl.classList.remove("hidden");
  } else {
    imageEl.removeAttribute("src");
    imageEl.classList.add("hidden");
    imageWrapperEl.classList.add("hidden");
  }

  answersEl.innerHTML = "";
  answersEl.classList.remove("hidden");

  openAnswerInputEl.value = "";
  openAnswerInputEl.disabled = false;

  hideElement("check-button");
  hideElement("next-button");
  hideElement("feedback");
  hideElement("open-answer-box");

  if (isOpenQuestion(question)) {
    answersEl.classList.add("hidden");
    showElement("open-answer-box");
    showElement("check-button");
    openAnswerInputEl.focus();
    return;
  }

  if (isOrderQuestion(question)) {
    renderOrderQuestion(question, answersEl);
    showElement("check-button");
    return;
  }

  const shuffledAnswers = shuffleArray(question.answers || []);

  answersEl.innerHTML = shuffledAnswers.map((answer) => `
    <button
      class="answer-btn"
      data-correct="${answer.is_correct}"
      type="button"
    >
      ${answer.text}
    </button>
  `).join("");

  const buttons = document.querySelectorAll(".answer-btn");

  if (question.selection_type === "multiple") {
    showElement("check-button");

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        if (hasAnswered) return;
        button.classList.toggle("selected");
      });
    });
  } else {
    buttons.forEach((button) => {
      button.addEventListener("click", handleSingleAnswerClick);
    });
  }
}

// SECTION: quiz-answer-feedback-ui
// UI helpers for locking answers and applying correct/incorrect styles.
function lockAnswers() {
  document.querySelectorAll(".answer-btn").forEach((btn) => {
    btn.disabled = true;
  });
}

function lockOrderItems() {
  document.querySelectorAll(".order-move-btn").forEach((btn) => {
    btn.disabled = true;
  });
}

function showCorrectAndIncorrectStates(selectedButtons = []) {
  document.querySelectorAll(".answer-btn").forEach((btn) => {
    const isCorrect = btn.dataset.correct === "true";
    const isSelected = selectedButtons.includes(btn);

    if (isCorrect) {
      btn.classList.add("correct");
    } else if (isSelected) {
      btn.classList.add("incorrect");
    }
  });
}

function showOrderItemStates(isCorrectOverall) {
  document.querySelectorAll(".order-item").forEach((item) => {
    item.classList.add(isCorrectOverall ? "correct" : "incorrect");
  });
}

function showFeedback(isCorrectOverall, explanation) {
  const feedbackEl = document.getElementById("feedback");

  if (isCorrectOverall) {
    feedbackEl.textContent = "Dobrze";
    feedbackEl.className = "feedback correct-feedback";
  } else {
    feedbackEl.textContent = explanation || "";
    feedbackEl.className = "feedback incorrect-feedback";
  }

  feedbackEl.classList.remove("hidden");
  showElement("next-button");
  hideElement("check-button");
}

// SECTION: quiz-order-rendering
// Renders a lightweight reorder list using up/down controls.
function renderOrderQuestion(question, answersEl) {
  const shuffledItems = shuffleArray(question.order_items || []);
  const orderListEl = document.createElement("div");
  orderListEl.className = "order-list";

  shuffledItems.forEach((item) => {
    orderListEl.appendChild(createOrderItemElement(item));
  });

  answersEl.appendChild(orderListEl);
  updateOrderMoveButtons(orderListEl);
}

function createOrderItemElement(item) {
  const itemEl = document.createElement("div");
  itemEl.className = "order-item";
  itemEl.dataset.orderItemId = item.id;

  const textEl = document.createElement("span");
  textEl.className = "order-item-text";
  textEl.textContent = item.text;

  const controlsEl = document.createElement("span");
  controlsEl.className = "order-controls";

  const moveUpButton = createOrderMoveButton("up", "\u2191", "Przesuń wyżej");
  const moveDownButton = createOrderMoveButton("down", "\u2193", "Przesuń niżej");

  controlsEl.append(moveUpButton, moveDownButton);
  itemEl.append(textEl, controlsEl);

  return itemEl;
}

function createOrderMoveButton(direction, label, ariaLabel) {
  const button = document.createElement("button");
  button.className = "order-move-btn";
  button.type = "button";
  button.dataset.orderMove = direction;
  button.textContent = label;
  button.setAttribute("aria-label", ariaLabel);
  button.addEventListener("click", handleOrderMoveClick);
  return button;
}

function handleOrderMoveClick(event) {
  if (hasAnswered) return;

  const button = event.currentTarget;
  const itemEl = button.closest(".order-item");
  const listEl = itemEl.closest(".order-list");

  if (button.dataset.orderMove === "up" && itemEl.previousElementSibling) {
    listEl.insertBefore(itemEl, itemEl.previousElementSibling);
  }

  if (button.dataset.orderMove === "down" && itemEl.nextElementSibling) {
    listEl.insertBefore(itemEl.nextElementSibling, itemEl);
  }

  updateOrderMoveButtons(listEl);
}

function updateOrderMoveButtons(listEl) {
  const items = Array.from(listEl.querySelectorAll(".order-item"));

  items.forEach((item, index) => {
    const moveUpButton = item.querySelector('[data-order-move="up"]');
    const moveDownButton = item.querySelector('[data-order-move="down"]');

    moveUpButton.disabled = index === 0;
    moveDownButton.disabled = index === items.length - 1;
  });
}

// SECTION: quiz-finish-and-progress
// End screen rendering and progression to subsequent questions.
function showFinalResult() {
  hideElement("quiz-screen");
  showElement("result-screen");

  const totalQuestions = currentQuiz.questions.length;
  const percentage = getScorePercentage(score, totalQuestions);
  const grade = getFinalGrade(score, totalQuestions);
  const message = getFinalMessage(score, totalQuestions);
  const emoji = getFinalEmoji(score, totalQuestions);

  const finalScoreEl = document.getElementById("final-score");
  const finalPercentageEl = document.getElementById("final-percentage");
  const finalGradeEl = document.getElementById("final-grade");
  const finalMessageEl = document.getElementById("final-message");
  const resultEmojiEl = document.getElementById("result-emoji");

  if (finalScoreEl) {
    finalScoreEl.textContent = `${score}/${totalQuestions}`;
  }

  if (finalPercentageEl) {
    finalPercentageEl.textContent = `${percentage}%`;
  }

  if (finalGradeEl) {
    finalGradeEl.textContent = grade;
  }

  if (finalMessageEl) {
    finalMessageEl.textContent = message;
  }

  if (resultEmojiEl) {
    resultEmojiEl.textContent = emoji;
  }
}

function goToNextQuestion() {
  currentQuestionIndex += 1;

  if (currentQuestionIndex >= currentQuiz.questions.length) {
    showFinalResult();
    return;
  }

  renderQuestion();
}

function getFinalEmoji(currentScore, totalQuestions) {
  if (totalQuestions === 0) {
    return "🙂";
  }

  const percentage = (currentScore / totalQuestions) * 100;

  if (percentage < 50) {
    return "📚";
  }

  if (percentage < 75) {
    return "🙂";
  }

  if (percentage < 90) {
    return "👏";
  }

  if (percentage < 100) {
    return "🎉";
  }

  return "🏆";
}

function getQuestionProgressPercentage(position, totalQuestions) {
  if (totalQuestions === 0) {
    return 0;
  }

  return Math.round((position / totalQuestions) * 100);
}

function getQuestionHint(question) {
  if (question.selection_type === "open") {
    return "Wpisz kr\u00f3tk\u0105 odpowied\u017a.";
  }

  if (question.selection_type === "multiple") {
    const correctCount = (question.answers || []).filter((answer) => answer.is_correct).length;
    if (correctCount >= 2) {
      return `Wybierz ${correctCount} odpowiedzi.`;
    }
    return "Mo\u017cliwa jest wi\u0119cej ni\u017c jedna poprawna odpowied\u017a.";
  }

  if (question.selection_type === "order") {
    return "Ułóż wydarzenia od najwcześniejszego do najpóźniejszego.";
  }

  return "";
}
