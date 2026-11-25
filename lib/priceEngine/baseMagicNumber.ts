/**
 * Season-wide base magic number for the scaled price model
 * (see calculateScaledRoundPrices.ts).
 *
 * 2026: 5412.15, fitted by scripts/backtest-pricing.ts as ONE season-wide
 * value across Rounds 2-18 (variant A2X-nearest100, about $25 average
 * error). The per-round regression estimate (3b/a) stayed between
 * 5,409 and 5,413 all season.
 *
 * The weekly "magic number" is NOT this value; it is baseMN * k, which
 * changes every round.
 */
export const BASE_MAGIC_NUMBER_2026 = 5412.15;

/**
 * Each season's base magic number. Add the new season's value (from
 * estimateBaseMagicNumber on its first round of price changes) when it
 * starts; seasons without one have no baseMN to check against.
 */
export const BASE_MAGIC_NUMBERS: Record<number, number> = {
  2026: BASE_MAGIC_NUMBER_2026,
};

export function getBaseMagicNumber(season: number): number | null {
  return BASE_MAGIC_NUMBERS[season] ?? null;
}

export interface BaseMagicNumberSample {
  /** Published price before the round. */
  oldPrice: number;
  /** Published price after the round. */
  newPrice: number;
  /** Three-round average used for this round's price change. */
  threeRoundAverage: number;
}

export interface BaseMagicNumberEstimate {
  /** Fitted weight on old price (0.75 * k). */
  a: number;
  /** Fitted weight on the three-round average (0.25 * k * baseMN). */
  b: number;
  /** a / 0.75. */
  k: number;
  /** 3 * b / a. */
  baseMagicNumber: number;
  samples: number;
}

/**
 * Estimates a season's base magic number from ONE round of real price
 * changes, without the grid-search solver.
 *
 * Fits newPrice = a * oldPrice + b * threeRoundAverage by least squares
 * (no intercept). Under the scaled model a = 0.75k and b = 0.25k * baseMN,
 * so baseMN = 3b / a regardless of k.
 *
 * Pass only players whose price changed under the normal formula
 * (played, three or more scores). Returns null with fewer than two samples
 * or degenerate data.
 */
export function estimateBaseMagicNumber(
  samples: BaseMagicNumberSample[],
): BaseMagicNumberEstimate | null {
  if (samples.length < 2) {
    return null;
  }

  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  let sxp = 0;
  let syp = 0;

  for (const sample of samples) {
    const x = sample.oldPrice;
    const y = sample.threeRoundAverage;
    const p = sample.newPrice;

    sxx += x * x;
    sxy += x * y;
    syy += y * y;
    sxp += x * p;
    syp += y * p;
  }

  const determinant = sxx * syy - sxy * sxy;

  if (determinant === 0) {
    return null;
  }

  const a = (sxp * syy - syp * sxy) / determinant;
  const b = (syp * sxx - sxp * sxy) / determinant;

  if (a === 0) {
    return null;
  }

  return {
    a,
    b,
    k: a / 0.75,
    baseMagicNumber: (3 * b) / a,
    samples: samples.length,
  };
}
