import type { Quiz, QuizAnswers, QuizOutcome, QuizResult } from "./types";

/**
 * Outcomes best first: highest score, then tier (meta.tierPriorityOrder,
 * first listed wins), then the order outcomes appear in the JSON.
 */
export function rankOutcomes(
  quiz: Quiz,
  scores: Record<string, number>,
): QuizOutcome[] {
  const tierRank = new Map(
    quiz.meta.tierPriorityOrder.map((tier, index) => [tier, index]),
  );
  const jsonOrder = new Map(quiz.outcomes.map((o, index) => [o.id, index]));
  const rankOf = (o: QuizOutcome) =>
    tierRank.get(o.tier) ?? Number.MAX_SAFE_INTEGER;

  return [...quiz.outcomes].sort(
    (a, b) =>
      (scores[b.id] ?? 0) - (scores[a.id] ?? 0) ||
      rankOf(a) - rankOf(b) ||
      jsonOrder.get(a.id)! - jsonOrder.get(b.id)!,
  );
}

/**
 * Scores a set of answers. Unanswered questions add nothing. Throws if an
 * answer names a question or option that is not in the quiz.
 *
 * If a chosen option has forceOutcomeId, that outcome wins regardless of
 * score (the first such answer, in question order). The runner-up is the
 * best of the remaining outcomes by the normal rules.
 */
export function scoreQuiz(quiz: Quiz, answers: QuizAnswers): QuizResult {
  const scores: Record<string, number> = {};

  for (const outcome of quiz.outcomes) {
    scores[outcome.id] = 0;
  }

  for (const questionId of Object.keys(answers)) {
    if (!quiz.questions.some((q) => q.id === questionId)) {
      throw new Error(`Unknown question id "${questionId}"`);
    }
  }

  let forcedId: string | null = null;

  for (const question of quiz.questions) {
    const optionId = answers[question.id];

    if (optionId === undefined) {
      continue;
    }

    const option = question.options.find((o) => o.id === optionId);

    if (!option) {
      throw new Error(
        `Unknown option "${optionId}" for question "${question.id}"`,
      );
    }

    for (const [outcomeId, weight] of Object.entries(option.weights)) {
      scores[outcomeId] = (scores[outcomeId] ?? 0) + weight;
    }

    if (option.forceOutcomeId && forcedId === null) {
      forcedId = option.forceOutcomeId;
    }
  }

  const ranked = rankOutcomes(quiz, scores);
  const winner =
    (forcedId && quiz.outcomes.find((o) => o.id === forcedId)) || ranked[0];
  const runnerUp = ranked.find((o) => o.id !== winner.id) ?? null;

  return { winner, runnerUp, forced: winner.id === forcedId, scores };
}

/** Finds an outcome by an untrusted id (e.g. from the URL). Null if unknown. */
export function findOutcome(quiz: Quiz, id: unknown): QuizOutcome | null {
  const value = Array.isArray(id) ? id[0] : id;

  if (typeof value !== "string") {
    return null;
  }

  return quiz.outcomes.find((o) => o.id === value) ?? null;
}
