/**
 * A player's current state rebuilt from their public round-by-round
 * history (the per-player SuperCoach endpoint), with the breakeven from
 * our own scaled engine. Nothing here uses subscriber-only data.
 *
 * Shared by the normalised-players build (as of the latest round) and the
 * DEBUG_AS_OF_ROUND lock (as of Round N), so both derive the same way.
 *
 * Relative imports only (no "@/" at runtime) so plain Node can load it.
 */

import type { Player } from "../../types/player";
import { getBaseMagicNumber } from "../priceEngine/baseMagicNumber";
import { calculateScaledBreakEven } from "../priceEngine/calculateScaledPlayerPrice";
import { estimateScaledRoundContexts } from "../priceEngine/estimateScaledRoundContexts";

/** The parts of data/{season}/fixtures-raw.json used for breakevens. */
export interface FixtureRounds {
  season: number;
  rounds: {
    round: number;
    response: Record<string, unknown>[];
  }[];
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

/** The latest round with a published price in the player's history. */
export function latestPricedRound(player: Pick<Player, "history">): number | null {
  const priced = player.history.filter((row) => row.price != null);

  return priced.length === 0
    ? null
    : Math.max(...priced.map((row) => row.round));
}

/**
 * The player as of `round`: history after it removed; price, games,
 * averages and recent scores rebuilt from Round 0..round. Price is the
 * published price at `round`, or the latest one before it.
 *
 * The breakeven is set to 0 here: it needs the whole league (see
 * withScaledBreakevens).
 */
export function rebuildFromHistory(player: Player, round: number): Player {
  const history = player.history.filter((row) => row.round <= round);
  const scores = history
    .filter((row) => row.games > 0 && row.score !== null)
    .map((row) => row.score as number);

  const priced = history.filter((row) => row.price != null);
  const latest = priced[priced.length - 1];

  return {
    ...player,
    price: latest?.price ?? 0,
    games: scores.length,
    average: average(scores),
    average3: average(scores.slice(-3)),
    average5: average(scores.slice(-5)),
    recentScores: scores,
    history,
    breakeven: 0,
  };
}

/**
 * Sets each player's breakeven to the scaled model's breakeven for
 * Round round+1, from these players only. Players stay at 0 when there is
 * no next round or fewer than two previous scores.
 */
export function withScaledBreakevens(
  players: Player[],
  fixtures: FixtureRounds,
  round: number,
): Player[] {
  const baseMagicNumber = getBaseMagicNumber(fixtures.season);
  const games = new Set(
    fixtures.rounds.flatMap((fixtureRound) =>
      fixtureRound.response.flatMap((game) => {
        const team1 = (game.team1 as { abbrev?: string } | undefined)?.abbrev;
        const team2 = (game.team2 as { abbrev?: string } | undefined)?.abbrev;
        return [`${fixtureRound.round}:${team1}`, `${fixtureRound.round}:${team2}`];
      }),
    ),
  );

  const hasNextRound = fixtures.rounds.some(
    (fixtureRound) => fixtureRound.round === round + 1,
  );

  const context =
    baseMagicNumber === null || !hasNextRound
      ? undefined
      : estimateScaledRoundContexts({
          players,
          firstRound: round + 1,
          lastRound: round + 1,
          baseMagicNumber,
          teamHasGame: (team, gameRound) => games.has(`${gameRound}:${team}`),
        }).get(round + 1);

  return players.map((player) => ({
    ...player,
    breakeven: context
      ? (calculateScaledBreakEven({
          context,
          playerId: player.id,
          oldPrice: player.price,
          previousScores: player.recentScores,
        }) ?? 0)
      : 0,
  }));
}
