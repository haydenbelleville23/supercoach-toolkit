import rawRuckQuiz from "../../data/quiz/ruck-quiz.json";

import { parseQuiz } from "./parseQuiz";

/** The "Which ruck are you?" quiz, validated once when first imported. */
export const ruckQuiz = parseQuiz(rawRuckQuiz);

/** Public path of an outcome's card image. */
export function ruckCardSrc(outcomeId: string): string {
  return `/rucks/${outcomeId}.png`;
}
