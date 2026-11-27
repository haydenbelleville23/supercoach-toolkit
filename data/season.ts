import { DEBUG_AS_OF_ROUND } from "@/lib/asOf/debugAsOfRound";
import { getFixtures } from "@/lib/fixtures";
import { getPlayers } from "@/lib/players";
import { getLatestCompletedRound } from "@/lib/season/seasonStatus";

// The one season setting (lib/season/seasonYear.ts).
export { SEASON_YEAR } from "@/lib/season/seasonYear";
export const FIRST_ROUND = 0;
export const FINAL_ROUND = 24;

/**
 * Debug lock: DEBUG_AS_OF_ROUND=N shows the site as it was straight after
 * Round N (see next.config.ts and README). Null (unset) is normal.
 */
export { DEBUG_AS_OF_ROUND };

/**
 * Set a round number here to override the value derived from the data
 * (for example if a round's scores are only partly downloaded). Leave as
 * null to use the latest round in which every game has scores.
 */
export const CURRENT_COMPLETED_ROUND_OVERRIDE: number | null = null;

export const CURRENT_COMPLETED_ROUND: number =
  DEBUG_AS_OF_ROUND ??
  CURRENT_COMPLETED_ROUND_OVERRIDE ??
  getLatestCompletedRound(getPlayers(), getFixtures()) ??
  FIRST_ROUND - 1;

export function getSeasonRounds(): number[] {
  return Array.from(
    { length: FINAL_ROUND - FIRST_ROUND + 1 },
    (_, index) => FIRST_ROUND + index,
  );
}
