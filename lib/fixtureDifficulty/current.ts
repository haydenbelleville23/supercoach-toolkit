import { CURRENT_COMPLETED_ROUND } from "@/data/season";
import { getFixtures } from "@/lib/fixtures";
import { playerRepository } from "@/lib/repository/PlayerRepository";
import type { Player } from "@/types/player";

import { matchupAdjustment, type MatchupAdjustment } from "./matchup";
import { computePositionDifficulty, type PositionDifficulty } from "./positionDifficulty";
import { computeTeamDifficulty, type TeamDifficulty } from "./teamDifficulty";

/**
 * The difficulty tables the site uses, computed once from the same player
 * data as everything else. Under DEBUG_AS_OF_ROUND that data is already
 * trimmed to the locked round, and the cut-off is that round, so no later
 * round can leak in.
 */
export const DIFFICULTY_AS_OF_ROUND = CURRENT_COMPLETED_ROUND;

let positionCache: PositionDifficulty | null = null;
let teamCache: TeamDifficulty[] | null = null;

export function currentPositionDifficulty(): PositionDifficulty {
  positionCache ??= computePositionDifficulty(playerRepository.getAll(), DIFFICULTY_AS_OF_ROUND);
  return positionCache;
}

export function currentTeamDifficulty(): TeamDifficulty[] {
  teamCache ??= computeTeamDifficulty(playerRepository.getAll(), DIFFICULTY_AS_OF_ROUND);
  return teamCache;
}

/** A player's matchup in a round (opponent and adjustment), or null on a bye. */
export function currentMatchup(player: Pick<Player, "team" | "positions">, round: number): MatchupAdjustment | null {
  return matchupAdjustment(player, round, getFixtures(), currentPositionDifficulty());
}

/** The points to add for projectScore's Matchup method. */
export function currentMatchupValue(player: Player, round: number): number | null {
  return currentMatchup(player, round)?.value ?? null;
}
