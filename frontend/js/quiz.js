let currentQuiz = null;
let currentQuestionIndex = 0;

function renderQuestion() {
  const question = currentQuiz.questions[currentQuestionIndex];

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

  const answersEl = document.getElementById("answers");
  const shuffledAnswers = shuffleArray(question.answers);

  answersEl.innerHTML = shuffledAnswers.map((answer) => `
    <button class="answer-btn" data-correct="${answer.is_correct}">
      ${answer.text}
    </button>
  `).join("");

  document.querySelectorAll(".answer-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const isCorrect = button.dataset.correct === "true";
      alert(isCorrect ? "Dobrze" : `Źle. ${question.explanation || "Spróbuj ponownie przy następnym pytaniu."}`);
    });
  });
}

async function initQuizPage() {
  const statusEl = document.getElementById("status");
  const quizScreenEl = document.getElementById("quiz-screen");
  const quizId = getQueryParam("id");

  if (!quizId) {
    statusEl.textContent = "Brak id quizu w adresie.";
    return;
  }

  try {
    currentQuiz = await getQuizById(quizId);

    document.getElementById("quiz-title").textContent = currentQuiz.title;
    document.getElementById("quiz-description").textContent = currentQuiz.description;

    statusEl.classList.add("hidden");
    quizScreenEl.classList.remove("hidden");

    renderQuestion();
  } catch (error) {
    statusEl.textContent = `Błąd: ${error.message}`;
  }
}

initQuizPage();