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
import { getBaseMagicNumber } from "../priceEngine/baseMagicNumber";
import { calculateScaledBreakEven } from "../priceEngine/calculateScaledPlayerPrice";
import { estimateScaledRoundContexts } from "../priceEngine/estimateScaledRoundContexts";

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

function average(scores: number[]): number {
  return scores.length === 0
    ? 0
    : Math.round(
        (scores.reduce((total, score) => total + score, 0) /
          scores.length) *
          100,
      ) / 100;
}

/**
 * Players as of Round N.
 *
 * - Players without a published price at Round N did not exist yet
 *   (later additions and draftees) and are removed.
 * - History after Round N is removed. Price, games, averages and recent
 *   scores are rebuilt from Round 0..N.
 * - SuperCoach's own projections (captured later in the season) are
 *   cleared, so the projector falls back to the season average at N.
 * - Breakeven is the scaled model's breakeven for Round N+1, using only
 *   the trimmed data.
 * - Ownership, availability and active status have no history in the data
 *   and are left as captured.
 */
export function trimPlayersToRound(
  players: Player[],
  fixtures: RawFixtureFile,
  asOfRound: number,
): Player[] {
  const trimmed: Player[] = [];

  for (const player of players) {
    const atRound = player.history.find((row) => row.round === asOfRound);

    if (atRound?.price == null) {
      continue;
    }

    const history = player.history.filter((row) => row.round <= asOfRound);
    const scores = history
      .filter((row) => row.games > 0 && row.score !== null)
      .map((row) => row.score as number);

    const seasonAverage = average(scores);

    trimmed.push({
      ...player,
      price: atRound.price,
      games: scores.length,
      average: seasonAverage,
      average3: average(scores.slice(-3)),
      average5: average(scores.slice(-5)),
      recentScores: scores,
      history,
      breakeven: 0,
      projectedBreakEvens: [],
      projectedScore: Math.round(seasonAverage),
      projectedScores: [],
      projectedPrices: [],
      projectedPriceChanges: [],
      upcomingFixtures: [],
    });
  }

  // Breakevens for the next round from the trimmed data only.
  const baseMagicNumber = getBaseMagicNumber(fixtures.season);
  const games = new Set(
    fixtures.rounds.flatMap((round) =>
      round.response.flatMap((game) => {
        const team1 = (game.team1 as { abbrev?: string } | undefined)?.abbrev;
        const team2 = (game.team2 as { abbrev?: string } | undefined)?.abbrev;
        return [`${round.round}:${team1}`, `${round.round}:${team2}`];
      }),
    ),
  );

  const context =
    baseMagicNumber === null
      ? undefined
      : estimateScaledRoundContexts({
          players: trimmed,
          firstRound: asOfRound + 1,
          lastRound: asOfRound + 1,
          baseMagicNumber,
          teamHasGame: (team, round) => games.has(`${round}:${team}`),
        }).get(asOfRound + 1);

  if (context) {
    for (const player of trimmed) {
      player.breakeven =
        calculateScaledBreakEven({
          context,
          playerId: player.id,
          oldPrice: player.price,
          previousScores: player.recentScores,
        }) ?? 0;
    }
  }

  return trimmed;
}
