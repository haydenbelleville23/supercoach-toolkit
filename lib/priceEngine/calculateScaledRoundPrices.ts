/**
 * Scaled SuperCoach price model (backtest variant A2X-nearest100).
 *
 * Ported from scripts/backtest-pricing.ts, where it fitted the published
 * 2026 prices at about $25 average error.
 *
 *   raw_i      = 0.75 * oldPrice_i + 0.25 * baseMN * threeRoundAvg_i
 *   k          = poolShare / sum(raw_i over the pool)
 *   newPrice_i = nearest $100 of (k * raw_i)
 *
 * Variant A2X-nearest100:
 *   (A) players under 3 games are frozen at their old price and excluded
 *       from the pool and from scaling;
 *   (2) the pool is the players who played this round;
 *   (X) the anchor is the previous round's actual total of all prices;
 *   rounding is to the nearest $100.
 *
 * poolShare = anchorTotal minus the old prices of every player outside the
 * pool, so the pool's combined value is conserved.
 */

export type ScaledRoundCategory =
  /** Played this round and has at least three scores to date. */
  | "eligible"
  /** Played this round but has fewer than three scores. */
  | "under3"
  /** Did not play this round. */
  | "didNotPlay";

export interface ScaledRoundPlayerInput {
  playerId: number;
  /** Published price after the previous round. */
  oldPrice: number;
  category: ScaledRoundCategory;
  /** Three-round average; only used for eligible players. */
  threeRoundAverage: number;
}

export interface ScaledRoundPlayerPrice {
  playerId: number;
  oldPrice: number;
  predictedPrice: number;
  category: ScaledRoundCategory;
}

export interface ScaledRoundResult {
  k: number;
  baseMagicNumber: number;
  /** baseMN * k: the weekly magic number this round effectively used. */
  effectiveMagicNumber: number;
  anchorTotal: number;
  players: ScaledRoundPlayerPrice[];
}

export function roundPriceToNearest100(value: number): number {
  return Math.round(value / 100) * 100;
}

function isScaled(player: ScaledRoundPlayerInput): boolean {
  return player.category === "eligible";
}

function isInPool(player: ScaledRoundPlayerInput): boolean {
  // Variant A: under-3 players are excluded from the pool.
  // Pool 2: only players who played this round.
  return player.category === "eligible";
}

function rawPrice(
  player: ScaledRoundPlayerInput,
  baseMagicNumber: number,
): number {
  if (player.category !== "eligible") {
    return player.oldPrice;
  }

  return (
    0.75 * player.oldPrice +
    0.25 * baseMagicNumber * player.threeRoundAverage
  );
}

export function calculateScaledRoundPrices({
  players,
  baseMagicNumber,
  anchorTotal,
}: {
  players: ScaledRoundPlayerInput[];
  baseMagicNumber: number;
  /** Previous round's actual total of all published prices. */
  anchorTotal: number;
}): ScaledRoundResult {
  let poolShare = anchorTotal;
  let poolRawSum = 0;

  for (const player of players) {
    if (isInPool(player)) {
      poolRawSum += isScaled(player)
        ? rawPrice(player, baseMagicNumber)
        : player.oldPrice;
    } else {
      poolShare -= player.oldPrice;
    }
  }

  const k = poolRawSum === 0 ? 1 : poolShare / poolRawSum;

  return {
    k,
    baseMagicNumber,
    effectiveMagicNumber: baseMagicNumber * k,
    anchorTotal,
    players: players.map((player) => ({
      playerId: player.playerId,
      oldPrice: player.oldPrice,
      category: player.category,
      predictedPrice: isScaled(player)
        ? roundPriceToNearest100(k * rawPrice(player, baseMagicNumber))
        : player.oldPrice,
    })),
  };
}
