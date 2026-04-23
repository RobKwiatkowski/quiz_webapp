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
    feedbackEl.textContent = explanation || "";
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
  const percentage = getScorePercentage(score, totalQuestions);
  const message = getFinalMessage(score, totalQuestions);
  const emoji = getFinalEmoji(score, totalQuestions);

  const finalScoreEl = document.getElementById("final-score");
  const finalPercentageEl = document.getElementById("final-percentage");
  const finalMessageEl = document.getElementById("final-message");
  const resultEmojiEl = document.getElementById("result-emoji");

  if (finalScoreEl) {
    finalScoreEl.textContent = `${score}/${totalQuestions}`;
  }

  if (finalPercentageEl) {
    finalPercentageEl.textContent = `${percentage}%`;
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

  return "";
}
