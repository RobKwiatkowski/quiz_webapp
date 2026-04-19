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

function renderQuestion() {
  const question = currentQuiz.questions[currentQuestionIndex];
  hasAnswered = false;

  hideElement("status");
  showElement("quiz-screen");
  hideElement("result-screen");
  hideElement("feedback");
  hideElement("next-button");

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

  answersEl.innerHTML = shuffledAnswers.map((answer) => `
    <button
      class="answer-btn"
      data-correct="${answer.is_correct}"
      data-text="${answer.text.replace(/"/g, "&quot;")}"
    >
      ${answer.text}
    </button>
  `).join("");

  document.querySelectorAll(".answer-btn").forEach((button) => {
    button.addEventListener("click", handleAnswerClick);
  });
}

function handleAnswerClick(event) {
  if (hasAnswered) {
    return;
  }

  hasAnswered = true;
  const button = event.currentTarget;
  const isCorrect = button.dataset.correct === "true";
  const question = currentQuiz.questions[currentQuestionIndex];
  const feedbackEl = document.getElementById("feedback");

  if (isCorrect) {
    score += 1;
    button.classList.add("correct");
    feedbackEl.textContent = "Dobrze";
    feedbackEl.className = "feedback correct-feedback";
  } else {
    button.classList.add("incorrect");

    const correctButton = Array.from(document.querySelectorAll(".answer-btn")).find(
      (btn) => btn.dataset.correct === "true"
    );
    if (correctButton) {
      correctButton.classList.add("correct");
    }

    const explanation = question.explanation
      ? ` ${question.explanation}`
      : "";

    feedbackEl.textContent = `Niepoprawna odpowiedź.${explanation}`;
    feedbackEl.className = "feedback incorrect-feedback";
  }

  document.querySelectorAll(".answer-btn").forEach((btn) => {
    btn.disabled = true;
  });

  feedbackEl.classList.remove("hidden");
  showElement("next-button");
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

    renderQuestion();
  } catch (error) {
    console.error(error);
    statusEl.textContent = `Błąd: ${error.message}`;
  }
}

initQuizPage();