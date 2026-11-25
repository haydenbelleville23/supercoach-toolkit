import { getFixtures } from "@/lib/fixtures";
import { getPlayers } from "@/lib/players";
import {
  getLatestCompletedRound,
  isOffseason,
} from "@/lib/season/seasonStatus";

export const SEASON_YEAR = 2026;
export const FIRST_ROUND = 0;
export const FINAL_ROUND = 24;

/**
 * Set a round number here to override the value derived from the data
 * (for example if a round's scores are only partly downloaded). Leave as
 * null to use the latest round in which every game has scores.
 */
export const CURRENT_COMPLETED_ROUND_OVERRIDE: number | null = null;

export const CURRENT_COMPLETED_ROUND: number =
  CURRENT_COMPLETED_ROUND_OVERRIDE ??
  getLatestCompletedRound(getPlayers(), getFixtures()) ??
  FIRST_ROUND - 1;

/**
 * True when no rounds are left to project (see isOffseason). Pages show an
 * "projections start when the season opens" message instead of stale rounds.
 */
export function isSeasonOver(now: Date = new Date()): boolean {
  return isOffseason(getFixtures(), CURRENT_COMPLETED_ROUND, now);
}

export function getSeasonRounds(): number[] {
  return Array.from(
    { length: FINAL_ROUND - FIRST_ROUND + 1 },
    (_, index) => FIRST_ROUND + index,
  );
}
