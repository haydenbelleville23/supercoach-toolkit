/** Shapes of the "Which ruck are you?" quiz (data/quiz/ruck-quiz.json). */

export type QuizOutcome = {
  id: string;
  name: string;
  archetype: string;
  /** Lower tiers win ties first, in the order meta.tierPriorityOrder gives. */
  tier: number;
  club: string;
  description: string;
};

export type QuizOption = {
  id: string;
  text: string;
  /** Points per outcome id. Missing ids score 0. */
  weights: Record<string, number>;
  /** Picking this option makes that outcome win, whatever the scores. */
  forceOutcomeId?: string;
};

export type QuizQuestion = {
  id: string;
  number: number;
  prompt: string;
  options: QuizOption[];
};

export type QuizMeta = {
  title: string;
  version: string;
  totalQuestions: number;
  tierPriorityOrder: number[];
};

export type Quiz = {
  meta: QuizMeta;
  outcomes: QuizOutcome[];
  questions: QuizQuestion[];
};

/** Chosen option id for each question id. */
export type QuizAnswers = Record<string, string>;

export type QuizResult = {
  winner: QuizOutcome;
  /** Best of the rest by the same rules. Null only for a single-outcome quiz. */
  runnerUp: QuizOutcome | null;
  /** True when an option with forceOutcomeId decided the winner. */
  forced: boolean;
  /** Total points per outcome id, every outcome included. */
  scores: Record<string, number>;
};
