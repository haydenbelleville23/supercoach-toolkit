import { calculateScaledPlayerPrice } from "@/lib/priceEngine/calculateScaledPlayerPrice";
import type { ScaledRoundContext } from "@/lib/priceEngine/estimateScaledRoundContexts";
import type { Player } from "@/types/player";

import { projectScore } from "./projectScore";

export interface PlannerFixture {
  round: number;
  homeTeam: string;
  awayTeam: string;
}

export interface RoundProjection {
  round: number;
  /** Price before this round's games (after the previous round). */
  priceBefore: number;
  /** Projected or overridden score; null if not playing (bye or no history). */
  score: number | null;
  overridden: boolean;
  onBye: boolean;
  /** Price after this round's games. */
  priceAfter: number;
}

export interface PriceProjector {
  firstRound: number;
  lastRound: number;
  /** A player's round-by-round projection from the first planned round. */
  getPath(playerId: number): RoundProjection[];
  /** Price used for a trade in `round`: the price after round - 1. */
  getPriceBefore(playerId: number, round: number): number | null;
}

/**
 * Price paths for the planner, from the scaled engine.
 *
 * - The first planned round starts from the player's current price.
 * - Each round: if the player's team has a fixture, the score is the
 *   override (if any) or projectScore; the scaled model gives the new
 *   price with that round's estimated k. On a bye the price is unchanged.
 * - Overrides change only that player's own score (and so their price);
 *   other players' prices and k are not affected.
 */
export function createPriceProjector({
  players,
  contexts,
  fixtures,
  completedRound,
  lastRound,
  scoreOverrides = {},
}: {
  players: Player[];
  contexts: Map<number, ScaledRoundContext>;
  fixtures: PlannerFixture[];
  completedRound: number;
  lastRound: number;
  scoreOverrides?: Record<number, Record<number, number>>;
}): PriceProjector {
  const firstRound = completedRound + 1;
  const byId = new Map(players.map((p) => [p.id, p]));
  const cache = new Map<number, RoundProjection[]>();

  const teamsByRound = new Map<number, Set<string>>();
  for (const fixture of fixtures) {
    const teams = teamsByRound.get(fixture.round) ?? new Set<string>();
    teams.add(fixture.homeTeam);
    teams.add(fixture.awayTeam);
    teamsByRound.set(fixture.round, teams);
  }

  function getPath(playerId: number): RoundProjection[] {
    const cached = cache.get(playerId);
    if (cached) {
      return cached;
    }

    const player = byId.get(playerId);
    if (!player) {
      return [];
    }

    const scores = player.history
      .filter((row) => row.round <= completedRound && row.games > 0)
      .map((row) => row.score as number);

    let price = player.price;
    const path: RoundProjection[] = [];

    for (let round = firstRound; round <= lastRound; round++) {
      const onBye = !teamsByRound.get(round)?.has(player.team);
      const override = scoreOverrides[playerId]?.[round];
      const overridden = !onBye && override !== undefined;
      const score = onBye
        ? null
        : overridden
          ? override
          : projectScore(player, round, completedRound);

      const context = contexts.get(round);
      const priceAfter =
        context === undefined
          ? price
          : calculateScaledPlayerPrice({
              context,
              playerId,
              oldPrice: price,
              previousScores: scores,
              score,
            }).price;

      path.push({ round, priceBefore: price, score, overridden, onBye, priceAfter });

      if (score !== null) {
        scores.push(score);
      }
      price = priceAfter;
    }

    cache.set(playerId, path);
    return path;
  }

  return {
    firstRound,
    lastRound,
    getPath,
    getPriceBefore(playerId, round) {
      return getPath(playerId).find((r) => r.round === round)?.priceBefore ?? null;
    },
  };
}
