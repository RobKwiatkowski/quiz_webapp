export interface QuizFeedback {
  isCorrect: boolean;
  explanation: string;
  earnedPoints: number;
  maximumPoints: number;
}

export interface QuizSessionState {
  currentQuestionIndex: number;
  earnedPoints: number;
  selectedAnswerIndexes: number[];
  openAnswers: string[];
  feedback: QuizFeedback | null;
  hasAnswered: boolean;
}

export const initialQuizSessionState: QuizSessionState = {
  currentQuestionIndex: 0,
  earnedPoints: 0,
  selectedAnswerIndexes: [],
  openAnswers: [],
  feedback: null,
  hasAnswered: false,
};

export type QuizSessionAction =
  | { type: "select-answer"; answerIndex: number }
  | { type: "toggle-answer"; answerIndex: number }
  | { type: "set-open-answer"; slotIndex: number; value: string }
  | { type: "submit"; feedback: QuizFeedback }
  | { type: "next-question" }
  | { type: "restart" };

export function quizSessionReducer(
  state: QuizSessionState,
  action: QuizSessionAction,
): QuizSessionState {
  switch (action.type) {
    case "select-answer":
      return state.hasAnswered
        ? state
        : { ...state, selectedAnswerIndexes: [action.answerIndex] };
    case "toggle-answer": {
      if (state.hasAnswered) return state;

      const selectedAnswerIndexes = state.selectedAnswerIndexes.includes(action.answerIndex)
        ? state.selectedAnswerIndexes.filter((index) => index !== action.answerIndex)
        : [...state.selectedAnswerIndexes, action.answerIndex];

      return { ...state, selectedAnswerIndexes };
    }
    case "set-open-answer": {
      if (state.hasAnswered) return state;

      const openAnswers = [...state.openAnswers];
      openAnswers[action.slotIndex] = action.value;
      return { ...state, openAnswers };
    }
    case "submit":
      return state.hasAnswered
        ? state
        : {
            ...state,
            earnedPoints: state.earnedPoints + action.feedback.earnedPoints,
            feedback: action.feedback,
            hasAnswered: true,
          };
    case "next-question":
      return {
        ...state,
        currentQuestionIndex: state.currentQuestionIndex + 1,
        selectedAnswerIndexes: [],
        openAnswers: [],
        feedback: null,
        hasAnswered: false,
      };
    case "restart":
      return initialQuizSessionState;
  }
}
