let currentQuiz = null;
let currentQuestionIndex = 0;
let score = 0;
let hasAnswered = false;



function isOpenQuestion(question) {
  return question.selection_type === "open";
}

function normalizeAnswer(value) {
  const polishCharsMap = {
    ą: "a",
    ć: "c",
    ę: "e",
    ł: "l",
    ń: "n",
    ó: "o",
    ś: "s",
    ź: "z",
    ż: "z"
  };

  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+$/gu, "")
    .replace(/[ąćęłńóśźż]/g, (char) => polishCharsMap[char] || char);
}

function showElement(elementId) {
  document.getElementById(elementId).classList.remove("hidden");
}

function hideElement(elementId) {
  document.getElementById(elementId).classList.add("hidden");
}

function getCurrentQuestion() {
  return currentQuiz.questions[currentQuestionIndex];
}

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

function handleGlobalEnterAction(event) {
  if (event.key !== "Enter") {
    return;
  }

  const nextButton = document.getElementById("next-button");
  const checkButton = document.getElementById("check-button");

  const isNextVisible = !nextButton.classList.contains("hidden") && !nextButton.disabled;
  const isCheckVisible = !checkButton.classList.contains("hidden") && !checkButton.disabled;

  event.preventDefault();

  if (isNextVisible) {
    nextButton.click();
    return;
  }

  if (isCheckVisible) {
    checkButton.click();
  }
}

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
    imageEl.src = `${CONFIG.API_BASE_URL}${question.image}`;
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
    document.getElementById("check-button").addEventListener("click", handleCheckAction);
    document.addEventListener("keydown", handleGlobalEnterAction);

    renderQuestion();
  } catch (error) {
    console.error(error);
    statusEl.textContent = `Błąd: ${error.message}`;
  }
}

initQuizPage();