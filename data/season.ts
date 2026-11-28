import { DEBUG_AS_OF_ROUND } from "@/lib/asOf/debugAsOfRound";
import { FIXTURES_SEASON, getFixtures } from "@/lib/fixtures";
import { getPlayers } from "@/lib/players";
import { PLAYERS_DATA_SEASON } from "@/lib/season/dataSource";
import { deriveSeasonPhase, type SeasonPhase } from "@/lib/season/phase";
import { getLatestCompletedRound } from "@/lib/season/seasonStatus";
import { SEASON_YEAR } from "@/lib/season/seasonYear";

// The season settings (lib/season/seasonYear.ts): ACTIVE_SEASON is the
// committed one; SEASON_YEAR is the one shown (DEBUG_SEASON locally).
export { ACTIVE_SEASON, DEBUG_SEASON, SEASON_YEAR } from "@/lib/season/seasonYear";
export type { SeasonPhase };

/** The season the players data belongs to (last season's during a new preseason). */
export { PLAYERS_DATA_SEASON };
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

/**
 * Rounds only count as completed when the players data and the fixtures
 * are both this season's (a new season's preseason has last season's
 * players, whose scores must not complete the new season's rounds).
 */
const seasonDataMatches =
  PLAYERS_DATA_SEASON === SEASON_YEAR && FIXTURES_SEASON === SEASON_YEAR;

export const CURRENT_COMPLETED_ROUND: number =
  DEBUG_AS_OF_ROUND ??
  CURRENT_COMPLETED_ROUND_OVERRIDE ??
  (seasonDataMatches ? getLatestCompletedRound(getPlayers(), getFixtures()) : null) ??
  FIRST_ROUND - 1;

const fixtureRounds = getFixtures().map((fixture) => fixture.round);

/** "preseason" (no round completed), "inseason" or "complete". */
export const SEASON_PHASE: SeasonPhase = deriveSeasonPhase({
  completedRound: CURRENT_COMPLETED_ROUND,
  firstRound: FIRST_ROUND,
  lastFixtureRound: fixtureRounds.length > 0 ? Math.max(...fixtureRounds) : null,
});

export const IS_PRESEASON = SEASON_PHASE === "preseason";

export function getSeasonRounds(): number[] {
  return Array.from(
    { length: FINAL_ROUND - FIRST_ROUND + 1 },
    (_, index) => FIRST_ROUND + index,
  );
}
