import {
  CURRENT_COMPLETED_ROUND,
  FINAL_ROUND,
  SEASON_YEAR,
} from "@/data/season";
import { getFixtures } from "@/lib/fixtures";
import { createPriceProjector } from "@/lib/planner/pricePaths";
import type { TradePlan } from "@/lib/planner/types";
import { getScaledRoundContexts } from "@/lib/projector/getScaledRoundContexts";
import { playerRepository } from "@/lib/repository/PlayerRepository";

import type { Player } from "@/types/player";

/** Shared data for My Team and the Trade Planner (locked under DEBUG_AS_OF_ROUND). */
export const plannerPlayers: Player[] = playerRepository.getAll();
export const plannerPlayersById = new Map(plannerPlayers.map((p) => [p.id, p]));
export const plannerFixtures = getFixtures();
export const PLANNER_SEASON = SEASON_YEAR;
export const PLANNER_COMPLETED_ROUND = CURRENT_COMPLETED_ROUND;
export const PLANNER_LAST_ROUND = FINAL_ROUND;

export function playerLabel(player: Player): string {
  return `${player.name} (${player.team}, ${player.positions.join("/")})`;
}

/** Price projector for a plan (its score overrides feed the engine). */
export function createPlanProjector(plan: TradePlan | null) {
  return createPriceProjector({
    players: plannerPlayers,
    contexts: getScaledRoundContexts(),
    fixtures: plannerFixtures,
    completedRound: PLANNER_COMPLETED_ROUND,
    lastRound: PLANNER_LAST_ROUND,
    scoreOverrides: plan?.scoreOverrides ?? {},
  });
}
