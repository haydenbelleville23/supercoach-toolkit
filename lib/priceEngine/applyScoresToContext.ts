import type { ScaledRoundContext } from "./estimateScaledRoundContexts";

export interface ScoreUpdate {
  playerId: number;
  /** Player's price before this round. */
  oldPrice: number;
  /** Every score the player has before this round, oldest first. */
  previousScores: number[];
  /** Real (or entered) score this round; null if the player did not play. */
  score: number | null;
}

/**
 * Returns a copy of a round estimate with some players' assumed scores
 * replaced by real ones (for example live scores from finished games), and
 * k / effective MN recomputed. Uses the same rules as calculateScaledRoundPrices:
 * a player with a score and two previous scores joins the pool; anyone else
 * is frozen at their old price and removed from the pool's share.
 */
export function applyScoresToContext(
  context: ScaledRoundContext,
  updates: ScoreUpdate[],
): ScaledRoundContext {
  if (updates.length === 0) {
    return context;
  }

  let poolShare = context.poolShare;
  let poolRawSum = context.poolRawSum;
  const contributions = new Map(context.contributions);
  let realScoresUsed = context.realScoresUsed;

  for (const update of updates) {
    const assumed = contributions.get(update.playerId);

    if (assumed) {
      if (assumed.inPool) {
        poolRawSum -= assumed.raw;
      } else {
        poolShare += assumed.oldPrice;
      }
    }

    const lastTwo = update.previousScores.slice(-2);
    const inPool = update.score !== null && lastTwo.length === 2;

    const raw = inPool
      ? 0.75 * update.oldPrice +
        0.25 *
          context.baseMagicNumber *
          ((lastTwo[0] + lastTwo[1] + (update.score as number)) / 3)
      : update.oldPrice;

    if (inPool) {
      poolRawSum += raw;
    } else {
      poolShare -= update.oldPrice;
    }

    contributions.set(update.playerId, {
      inPool,
      oldPrice: update.oldPrice,
      raw,
    });

    if (update.score !== null) {
      realScoresUsed += 1;
    }
  }

  const k = poolRawSum === 0 ? 1 : poolShare / poolRawSum;

  return {
    ...context,
    poolShare,
    poolRawSum,
    k,
    effectiveMagicNumber: context.baseMagicNumber * k,
    realScoresUsed,
    contributions,
  };
}
