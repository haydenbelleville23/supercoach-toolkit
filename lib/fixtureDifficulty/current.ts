import {
  CURRENT_COMPLETED_ROUND,
  FINAL_ROUND,
  IS_PRESEASON,
  PLAYERS_DATA_SEASON,
  SEASON_YEAR,
} from "@/data/season";
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

/**
 * Where the difficulty values come from. In a new season's preseason
 * there are no games yet, so they come from last season's final data
 * (applied to the new fixtures); with no data at all there are none.
 */
export type DifficultyBasis =
  | { kind: "current"; season: number }
  | { kind: "previous"; season: number }
  | { kind: "none"; season: number };

export const DIFFICULTY_BASIS: DifficultyBasis =
  PLAYERS_DATA_SEASON === SEASON_YEAR
    ? { kind: "current", season: SEASON_YEAR }
    : IS_PRESEASON && PLAYERS_DATA_SEASON === SEASON_YEAR - 1
      ? { kind: "previous", season: PLAYERS_DATA_SEASON }
      : { kind: "none", season: SEASON_YEAR - 1 };

/** The last round of data the values use (all of last season in a preseason). */
const SOURCE_ROUND = DIFFICULTY_BASIS.kind === "previous" ? FINAL_ROUND : DIFFICULTY_AS_OF_ROUND;

let positionCache: PositionDifficulty | null = null;
let teamCache: TeamDifficulty[] | null = null;

export function currentPositionDifficulty(): PositionDifficulty {
  positionCache ??=
    DIFFICULTY_BASIS.kind === "none"
      ? new Map()
      : computePositionDifficulty(playerRepository.getAll(), SOURCE_ROUND);
  return positionCache;
}

export function currentTeamDifficulty(): TeamDifficulty[] {
  teamCache ??=
    DIFFICULTY_BASIS.kind === "none" ? [] : computeTeamDifficulty(playerRepository.getAll(), SOURCE_ROUND);
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
