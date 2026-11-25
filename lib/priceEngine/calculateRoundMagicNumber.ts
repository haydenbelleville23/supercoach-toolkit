
export type MagicNumberStatus =
  | "accurate"
  | "close"
  | "outside-tolerance"
  | "incomplete";

  export interface CompetitionPlayerState {
  price: number;
  gamesPlayed: number;
  recentScores: number[];
  projectedScore: number | null;
  active: boolean;
}

export interface MagicNumberRound {
  round: number;

  /**
   * The effective SuperCoach magic number observed or
   * manually entered for this round.
   */
  magicNumber: number | null;

  /**
   * The combined official price of all players included
   * in the player price pool.
   */
  totalPlayerPricePool: number | null;

  /**
   * The magic number we would have estimated before
   * official post-round prices were available.
   */
  estimatedMagicNumber: number | null;

  /**
   * The magic number solved retrospectively from the
   * available round data and official player prices.
   */
  calculatedMagicNumber: number | null;
}

export function getMagicNumberDifference(
  row: MagicNumberRound,
): number | null {
  if (
    row.magicNumber === null ||
    row.calculatedMagicNumber === null
  ) {
    return null;
  }

  return row.calculatedMagicNumber - row.magicNumber;
}

export function getMagicNumberStatus(
  row: MagicNumberRound,
): MagicNumberStatus {
  const difference = getMagicNumberDifference(row);

  if (difference === null) {
    return "incomplete";
  }

  const absoluteDifference = Math.abs(difference);

  if (absoluteDifference <= 2) {
    return "accurate";
  }

  if (absoluteDifference <= 10) {
    return "close";
  }

  return "outside-tolerance";
}