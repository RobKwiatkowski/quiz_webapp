let currentQuiz = null;
let currentQuestionIndex = 0;
let score = 0;
let hasAnswered = false;


function showElement(elementId) {
  document.getElementById(elementId).classList.remove("hidden");
}

function hideElement(elementId) {
  document.getElementById(elementId).classList.add("hidden");
}

function getCurrentQuestion() {
  return currentQuiz.questions[currentQuestionIndex];
}

function isMultipleChoice(question) {
  return question.selection_type === "multiple";
}

function renderQuestion() {
  const question = getCurrentQuestion();
  hasAnswered = false;

  hideElement("status");
  showElement("quiz-screen");
  hideElement("result-screen");
  hideElement("feedback");
  hideElement("next-button");
  hideElement("check-button");

  document.getElementById("question-counter").textContent =
    `Pytanie ${currentQuestionIndex + 1} z ${currentQuiz.questions.length}`;

  document.getElementById("question-text").textContent = question.text;

  const imageEl = document.getElementById("question-image");
  if (question.image) {
    imageEl.src = `${CONFIG.API_BASE_URL}${question.image}`;
    imageEl.classList.remove("hidden");
  } else {
    imageEl.classList.add("hidden");
    imageEl.removeAttribute("src");
  }

  const shuffledAnswers = shuffleArray(question.answers);
  const answersEl = document.getElementById("answers");

  answersEl.innerHTML = shuffledAnswers.map((answer, index) => `
    <button
      class="answer-btn"
      data-correct="${answer.is_correct}"
      data-index="${index}"
      type="button"
    >
      ${answer.text}
    </button>
  `).join("");

  const buttons = document.querySelectorAll(".answer-btn");

  if (isMultipleChoice(question)) {
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

function showFinalResult() {
  hideElement("quiz-screen");
  showElement("result-screen");

  document.getElementById("final-score").textContent =
    `Twój wynik: ${score}/${currentQuiz.questions.length}`;
}

function goToNextQuestion() {
  currentQuestionIndex += 1;

  if (currentQuestionIndex >= currentQuiz.questions.length) {
    showFinalResult();
    return;
  }

  renderQuestion();
}

async function initQuizPage() {
  const statusEl = document.getElementById("status");
  const quizId = getQueryParam("id");

  if (!quizId) {
    statusEl.textContent = "Brak id quizu w adresie.";
    return;
  }

  try {
    currentQuiz = await getQuizById(quizId);

    if (!currentQuiz.questions || currentQuiz.questions.length === 0) {
      statusEl.textContent = "Quiz nie zawiera pytań.";
      return;
    }

    document.getElementById("quiz-title").textContent = currentQuiz.title;
    document.getElementById("quiz-description").textContent = currentQuiz.description;

    document.getElementById("next-button").addEventListener("click", goToNextQuestion);
    document.getElementById("check-button").addEventListener("click", handleCheckMultipleAnswers);

    renderQuestion();
  } catch (error) {
    console.error(error);
    statusEl.textContent = `Błąd: ${error.message}`;
  }
}

initQuizPage();