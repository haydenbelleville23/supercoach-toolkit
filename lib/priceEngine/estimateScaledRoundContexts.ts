import type { Player } from "@/types/player";
import {
  calculateScaledRoundPrices,
  type ScaledRoundPlayerInput,
} from "./calculateScaledRoundPrices";

/**
 * League-wide estimate of one round under the scaled model, used to price
 * a single player's scenario (see calculateScaledPlayerPrice).
 *
 * k = poolShare / poolRawSum, exactly as in calculateScaledRoundPrices.
 * Each player's own contribution is kept so a scenario can swap it out.
 */
export interface ScaledRoundContext {
  round: number;
  baseMagicNumber: number;
  /** Total of all prices after the previous round (anchor X). */
  anchorTotal: number;
  /** anchorTotal minus the old prices of players outside the pool. */
  poolShare: number;
  /** Sum of raw prices over the pool (eligible players). */
  poolRawSum: number;
  k: number;
  effectiveMagicNumber: number;
  /** Players in this round who used a real score rather than a projection. */
  realScoresUsed: number;
  contributions: Map<number, { inPool: boolean; oldPrice: number; raw: number }>;
}

interface LeaguePlayerState {
  player: Player;
  price: number;
  scores: number[];
  /** Season average from real scores before the first estimated round. */
  projectedScore: number | null;
  /** Played their team's most recent completed game (lineup assumption). */
  inLineup: boolean;
}

function realScore(player: Player, round: number): number | null {
  const row = player.history.find((h) => h.round === round);
  return row && row.games > 0 ? row.score : null;
}

/**
 * Estimates k for each round from firstRound to lastRound.
 *
 * - Anchor: total of all prices after the previous round (published
 *   prices for completed rounds, model prices for estimated ones).
 * - A player with a real score this round uses it. Otherwise, if their team
 *   has a game still to play and they played their team's most recent
 *   completed game, they are assumed to play and score their season
 *   average from real scores before firstRound (no future data).
 * - A round counts as complete when every team with a game has a real
 *   score; its published prices then carry into the next round.
 */
export function estimateScaledRoundContexts({
  players,
  firstRound,
  lastRound,
  baseMagicNumber,
  teamHasGame,
}: {
  players: Player[];
  firstRound: number;
  lastRound: number;
  baseMagicNumber: number;
  teamHasGame: (team: string, round: number) => boolean;
}): Map<number, ScaledRoundContext> {
  const states: LeaguePlayerState[] = [];

  for (const player of players) {
    const previous = player.history.find((h) => h.round === firstRound - 1);

    if (previous?.price == null) {
      continue;
    }

    const playedRounds = player.history.filter(
      (h) => h.round < firstRound && h.games > 0,
    );
    const scores = playedRounds.map((h) => h.score as number);

    // Most recent round the player's team actually played before firstRound.
    let lastTeamGame: number | null = null;

    for (let round = firstRound - 1; round >= 0; round--) {
      if (teamHasGame(player.team, round)) {
        lastTeamGame = round;
        break;
      }
    }

    states.push({
      player,
      price: previous.price,
      scores,
      projectedScore:
        scores.length === 0
          ? null
          : scores.reduce((t, s) => t + s, 0) / scores.length,
      inLineup:
        lastTeamGame !== null && realScore(player, lastTeamGame) !== null,
    });
  }

  const contexts = new Map<number, ScaledRoundContext>();

  for (let round = firstRound; round <= lastRound; round++) {
    const teamsWithRealScores = new Set(
      states
        .filter((s) => realScore(s.player, round) !== null)
        .map((s) => s.player.team),
    );

    const anchorTotal = states.reduce((t, s) => t + s.price, 0);
    const inputs: ScaledRoundPlayerInput[] = [];
    const thisRoundScores: (number | null)[] = [];
    let realScoresUsed = 0;
    let roundComplete = true;

    for (const state of states) {
      const team = state.player.team;
      const hasGame = teamHasGame(team, round);

      if (hasGame && !teamsWithRealScores.has(team)) {
        roundComplete = false;
      }

      let score = realScore(state.player, round);

      if (score !== null) {
        realScoresUsed += 1;
      } else if (
        hasGame &&
        !teamsWithRealScores.has(team) &&
        state.inLineup &&
        state.projectedScore !== null
      ) {
        score = state.projectedScore;
      }

      thisRoundScores.push(score);

      const lastTwo = state.scores.slice(-2);
      const eligible = score !== null && lastTwo.length === 2;

      inputs.push({
        playerId: state.player.id,
        oldPrice: state.price,
        category:
          score === null ? "didNotPlay" : eligible ? "eligible" : "under3",
        threeRoundAverage: eligible
          ? (lastTwo[0] + lastTwo[1] + (score as number)) / 3
          : 0,
      });
    }

    const result = calculateScaledRoundPrices({
      players: inputs,
      baseMagicNumber,
      anchorTotal,
    });

    let poolShare = anchorTotal;
    let poolRawSum = 0;
    const contributions: ScaledRoundContext["contributions"] = new Map();

    for (const input of inputs) {
      const inPool = input.category === "eligible";
      const raw = inPool
        ? 0.75 * input.oldPrice +
          0.25 * baseMagicNumber * input.threeRoundAverage
        : input.oldPrice;

      if (inPool) {
        poolRawSum += raw;
      } else {
        poolShare -= input.oldPrice;
      }

      contributions.set(input.playerId, {
        inPool,
        oldPrice: input.oldPrice,
        raw,
      });
    }

    contexts.set(round, {
      round,
      baseMagicNumber,
      anchorTotal,
      poolShare,
      poolRawSum,
      k: result.k,
      effectiveMagicNumber: result.effectiveMagicNumber,
      realScoresUsed,
      contributions,
    });

    // Advance every player to the next round.
    states.forEach((state, index) => {
      const published = state.player.history.find((h) => h.round === round);

      state.price =
        roundComplete && published?.price != null
          ? published.price
          : result.players[index].predictedPrice;

      const score = thisRoundScores[index];

      if (score !== null) {
        state.scores.push(score);
      }
    });
  }

  return contexts;
}
