const API_BASE_URL = "http://127.0.0.1:8000";

async function getQuizzes() {
  const response = await fetch(`${CONFIG.API_BASE_URL}/api/quizzes`);
  if (!response.ok) {
    throw new Error("Failed to load quizzes");
  }
  return response.json();
}