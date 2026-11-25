import { roundPriceToNearest100 } from "./calculateScaledRoundPrices";
import type { ScaledRoundContext } from "./estimateScaledRoundContexts";

export interface ScaledPlayerPriceInput {
  context: ScaledRoundContext;
  playerId: number;
  /** Player's price before this round. */
  oldPrice: number;
  /** Every score the player has before this round, oldest first. */
  previousScores: number[];
  /** Scenario score this round, or null if the player does not play. */
  score: number | null;
}

export interface ScaledPlayerPriceResult {
  price: number;
  priceChange: number;
  /** k after swapping this player's scenario into the round estimate. */
  k: number;
  effectiveMagicNumber: number;
  threeRoundAverage: number | null;
}

/**
 * One player's price for one scenario score under the scaled model.
 *
 * The round's league estimate (context) already contains an assumed
 * contribution for this player; it is swapped out for the scenario so k
 * reflects exactly the score being entered. A player who does not play, or
 * who has fewer than three scores including this one, keeps their price.
 */
export function calculateScaledPlayerPrice({
  context,
  playerId,
  oldPrice,
  previousScores,
  score,
}: ScaledPlayerPriceInput): ScaledPlayerPriceResult {
  let poolShare = context.poolShare;
  let poolRawSum = context.poolRawSum;

  const assumed = context.contributions.get(playerId);

  if (assumed) {
    if (assumed.inPool) {
      poolRawSum -= assumed.raw;
    } else {
      poolShare += assumed.oldPrice;
    }
  }

  const lastTwo = previousScores.slice(-2);
  const eligible = score !== null && lastTwo.length === 2;

  const threeRoundAverage = eligible
    ? (lastTwo[0] + lastTwo[1] + (score as number)) / 3
    : null;

  const raw =
    threeRoundAverage === null
      ? oldPrice
      : 0.75 * oldPrice +
        0.25 * context.baseMagicNumber * threeRoundAverage;

  if (eligible) {
    poolRawSum += raw;
  } else {
    poolShare -= oldPrice;
  }

  const k = poolRawSum === 0 ? 1 : poolShare / poolRawSum;
  const price = eligible ? roundPriceToNearest100(k * raw) : oldPrice;

  return {
    price,
    priceChange: price - oldPrice,
    k,
    effectiveMagicNumber: context.baseMagicNumber * k,
    threeRoundAverage,
  };
}

const MIN_SCORE = -200;
const MAX_SCORE = 600;

/**
 * Breakeven under the scaled model: the lowest whole score at which the
 * player's price does not fall (after $100 rounding). Uses the same
 * calculateScaledPlayerPrice, so price(BE) >= oldPrice > price(BE - 1).
 *
 * Returns null if the player's price cannot change this round (fewer than
 * two previous scores).
 */
export function calculateScaledBreakEven(
  input: Omit<ScaledPlayerPriceInput, "score">,
): number | null {
  if (input.previousScores.length < 2) {
    return null;
  }

  const holds = (score: number) =>
    calculateScaledPlayerPrice({ ...input, score }).price >= input.oldPrice;

  if (holds(MIN_SCORE)) {
    return MIN_SCORE;
  }

  if (!holds(MAX_SCORE)) {
    return MAX_SCORE;
  }

  // Price rises with score, so binary search for the first score that holds.
  let low = MIN_SCORE;
  let high = MAX_SCORE;

  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);

    if (holds(middle)) {
      high = middle;
    } else {
      low = middle;
    }
  }

  return high;
}
