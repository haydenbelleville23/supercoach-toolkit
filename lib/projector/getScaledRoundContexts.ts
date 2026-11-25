import { CURRENT_COMPLETED_ROUND, FINAL_ROUND } from "@/data/season";
import { getTeamFixture } from "@/lib/fixtures";
import { BASE_MAGIC_NUMBER_2026 } from "@/lib/priceEngine/baseMagicNumber";
import {
  estimateScaledRoundContexts,
  type ScaledRoundContext,
} from "@/lib/priceEngine/estimateScaledRoundContexts";
import { playerRepository } from "@/lib/repository/PlayerRepository";

let cachedContexts: Map<number, ScaledRoundContext> | null = null;

/**
 * League-wide scaled-model estimates for every round after the last
 * completed one. Computed once and cached; real scores in the player data
 * are used automatically as they come in.
 */
export function getScaledRoundContexts(): Map<number, ScaledRoundContext> {
  if (cachedContexts === null) {
    cachedContexts = estimateScaledRoundContexts({
      players: playerRepository.getAll(),
      firstRound: CURRENT_COMPLETED_ROUND + 1,
      lastRound: FINAL_ROUND,
      baseMagicNumber: BASE_MAGIC_NUMBER_2026,
      teamHasGame: (team, round) => getTeamFixture(team, round) !== null,
    });
  }

  return cachedContexts;
}

/** Projected k and effective MN (baseMN x k) for a future round. */
export function getScaledRoundEstimate(
  round: number,
): { k: number; effectiveMagicNumber: number } | null {
  const context = getScaledRoundContexts().get(round);

  return context
    ? { k: context.k, effectiveMagicNumber: context.effectiveMagicNumber }
    : null;
}
