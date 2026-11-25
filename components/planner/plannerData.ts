import {
  CURRENT_COMPLETED_ROUND,
  FINAL_ROUND,
  SEASON_YEAR,
} from "@/data/season";
import { getFixtures } from "@/lib/fixtures";
import {
  isPlaceholderId,
  placeholderToPlayer,
  withPlaceholders,
} from "@/lib/planner/placeholders";
import { createPriceProjector } from "@/lib/planner/pricePaths";
import type { MyTeam, TradePlan } from "@/lib/planner/types";
import { getScaledRoundContexts } from "@/lib/projector/getScaledRoundContexts";
import { playerRepository } from "@/lib/repository/PlayerRepository";
import {
  getSeasonTeams,
  PLAN_START_ROUNDS,
  POSITIONS,
  type Position,
} from "@/lib/rules/squadRules";

import type { Player } from "@/types/player";

/** Shared data for My Team and the Trade Planner (locked under DEBUG_AS_OF_ROUND). */
export const plannerPlayers: Player[] = playerRepository.getAll();
export const plannerPlayersById = new Map(plannerPlayers.map((p) => [p.id, p]));
export const plannerFixtures = getFixtures();
export const plannerTeams = [...getSeasonTeams(plannerFixtures)].sort();
export const PLANNER_SEASON = SEASON_YEAR;
export const PLANNER_COMPLETED_ROUND = CURRENT_COMPLETED_ROUND;
export const PLANNER_LAST_ROUND = FINAL_ROUND;

/** Real players plus this team's rookie placeholders. */
export function teamPlayersById(team: MyTeam | null): Map<number, Player> {
  return withPlaceholders(plannerPlayersById, team);
}

export function playerLabel(player: Player): string {
  return isPlaceholderId(player.id)
    ? player.name
    : `${player.name} (${player.team}, ${player.positions.join("/")})`;
}

/** Picker entries that create a new "Rookie (TBC)" placeholder. */
export const ROOKIE_OPTIONS: { label: string; position: Position }[] = POSITIONS.map(
  (position) => ({ label: `+ New Rookie (TBC) ${position}`, position }),
);

/** Price projector for a plan (its score overrides feed the engine). */
export function createPlanProjector(plan: TradePlan | null, team: MyTeam | null) {
  return createPriceProjector({
    players: plannerPlayers,
    contexts: getScaledRoundContexts(),
    fixtures: plannerFixtures,
    completedRound: PLANNER_COMPLETED_ROUND,
    lastRound: PLANNER_LAST_ROUND,
    scoreOverrides: plan?.scoreOverrides ?? {},
    placeholders: new Map(
      (team?.placeholders ?? []).map((p) => [p.id, placeholderToPlayer(p)]),
    ),
  });
}

/** First round a plan can include, and how many rounds are left. */
export const PLANNER_FIRST_ROUND = PLANNER_COMPLETED_ROUND + 1;
export const PLANNER_MAX_ROUNDS = PLANNER_LAST_ROUND - PLANNER_FIRST_ROUND + 1;

/** Rounds a plan shows (default 3), within the season. */
export function planRoundCount(plan: TradePlan | null): number {
  return Math.max(1, Math.min(plan?.roundCount ?? PLAN_START_ROUNDS, PLANNER_MAX_ROUNDS));
}
