// SECTION: quiz-keyboard-shortcuts
// Global Enter behavior: confirm answer or move to next question.
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
