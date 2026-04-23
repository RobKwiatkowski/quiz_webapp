// SECTION: quiz-bootstrap
// Page initialization: loads quiz data and wires event listeners.
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
