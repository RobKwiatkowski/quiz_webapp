const API_BASE_URL = "/quiz-api";

async function getQuizzes() {
  const response = await fetch(`${CONFIG.API_BASE_URL}/api/quizzes`);
  if (!response.ok) {
    throw new Error("Failed to load quizzes");
  }
  return response.json();
}

async function getQuizById(quizId) {
  const response = await fetch(`${CONFIG.API_BASE_URL}/api/quizzes/${quizId}`);
  if (!response.ok) {
    throw new Error("Failed to load quiz");
  }
  return response.json();
}

async function getMathQuestion() {
  const response = await fetch(`${CONFIG.API_BASE_URL}/api/math/question`);
  if (!response.ok) {
    throw new Error("LLM server unavailable");
  }
  return response.json();
}

async function checkAnswerWithLlm(question, studentAnswer) {
  const correctAnswer = (question.accepted_answers || [])[0] || "";
  const response = await fetch(`${CONFIG.LLM_API_BASE_URL}/check-answer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      question: question.text,
      correct_answer: correctAnswer,
      student_answer: studentAnswer
    })
  });

  if (!response.ok) {
    throw new Error("Failed to check answer with LLM");
  }

  return response.json();
}
