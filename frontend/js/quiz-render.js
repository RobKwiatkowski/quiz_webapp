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

  showElement("quiz-screen");
  hideElement("result-screen");
  hideElement("status");

  hasAnswered = false;

  document.getElementById("question-counter").textContent =
    `Pytanie ${currentQuestionIndex + 1} z ${currentQuiz.questions.length}`;

  document.getElementById("question-text").textContent = question.text;

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

function showFeedback(isCorrectOverall, explanation) {
  const feedbackEl = document.getElementById("feedback");

  if (isCorrectOverall) {
    feedbackEl.textContent = "Dobrze";
    feedbackEl.className = "feedback correct-feedback";
  } else {
    feedbackEl.textContent = explanation
      ? `Niepoprawna odpowiedź. ${explanation}`
      : "Niepoprawna odpowiedź.";
    feedbackEl.className = "feedback incorrect-feedback";
  }

  feedbackEl.classList.remove("hidden");
  showElement("next-button");
  hideElement("check-button");
}

// SECTION: quiz-finish-and-progress
// End screen rendering and progression to subsequent questions.
function showFinalResult() {
  hideElement("quiz-screen");
  showElement("result-screen");

  const totalQuestions = currentQuiz.questions.length;
  const message = getFinalMessage(score, totalQuestions);
  const finalScoreEl = document.getElementById("final-score");
  let finalMessageEl = document.getElementById("final-message");

  if (!finalMessageEl && finalScoreEl && finalScoreEl.parentElement) {
    finalMessageEl = document.createElement("p");
    finalMessageEl.id = "final-message";
    finalScoreEl.parentElement.insertBefore(finalMessageEl, finalScoreEl.nextSibling);
  }

  if (finalScoreEl) {
    finalScoreEl.textContent = "Twój wynik: " + score + "/" + totalQuestions;
  }

  if (finalMessageEl) {
    finalMessageEl.classList.remove("hidden");
    finalMessageEl.textContent = message;
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
