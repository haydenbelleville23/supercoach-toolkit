/**
 * "As of round N" data for the DEBUG_AS_OF_ROUND lock.
 *
 * Produces the player list and fixture file exactly as they would have
 * been known straight after Round N: nothing from later rounds survives.
 * Used by scripts/build-as-of-data.ts at build time, so the trimmed files
 * are what gets bundled and later rounds never reach the browser.
 *
 * Relative imports only (no "@/" at runtime) so plain Node can load it.
 */

import type { Player } from "../../types/player";
import {
  rebuildFromHistory,
  withScaledBreakevens,
} from "../supercoach/publicPlayerState";

/** Shape of data/{season}/fixtures-raw.json (only the parts used here). */
export interface RawFixtureFile {
  season: number;
  downloadedAt: string;
  rounds: {
    round: number;
    response: Record<string, unknown>[];
  }[];
}

const RESULT_FIELDS = [
  "team1_score",
  "team2_score",
  "team1_score_verbose",
  "team2_score_verbose",
  "margin_game",
  "period",
  "period_status",
  "period_seconds",
] as const;

/**
 * Fixtures with results removed after Round N. Kickoff times and venues
 * stay: the schedule was known in advance.
 */
export function trimFixturesToRound(
  file: RawFixtureFile,
  asOfRound: number,
): RawFixtureFile {
  return {
    ...file,
    rounds: file.rounds.map((round) =>
      round.round <= asOfRound
        ? round
        : {
            ...round,
            response: round.response.map((game) => {
              const scheduled: Record<string, unknown> = { ...game };

              for (const field of RESULT_FIELDS) {
                scheduled[field] = null;
              }

              scheduled.match_status = "Scheduled";
              scheduled.status = "pre";

              return scheduled;
            }),
          },
    ),
  };
}

/**
 * Players as of Round N.
 *
 * - Players without a published price at Round N did not exist yet
 *   (later additions and draftees) and are removed.
 * - History after Round N is removed. Price, games, averages and recent
 *   scores are rebuilt from Round 0..N (see rebuildFromHistory).
 * - Breakeven is the scaled model's breakeven for Round N+1, using only
 *   the trimmed data.
 * - Availability and active status have no history in the data and are
 *   left as captured. Ownership has no public source and stays null.
 */
export function trimPlayersToRound(
  players: Player[],
  fixtures: RawFixtureFile,
  asOfRound: number,
): Player[] {
  const trimmed = players
    .filter(
      (player) =>
        player.history.find((row) => row.round === asOfRound)?.price != null,
    )
    .map((player) => rebuildFromHistory(player, asOfRound));

  return withScaledBreakevens(trimmed, fixtures, asOfRound);
}
