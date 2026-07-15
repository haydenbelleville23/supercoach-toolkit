import { simulateRound } from "./simulateRound";

import type {
  PlayerState,
  RoundResult,
} from "./types";

export function projectSeason(
  initialState: PlayerState,
  projectedScores: number[],
): RoundResult[] {
  let state = initialState;

  const results: RoundResult[] = [];

  for (const score of projectedScores) {
    const result = simulateRound(
      state,
      score,
    );

    results.push(result);

    state = result.state;
  }

  return results;
}