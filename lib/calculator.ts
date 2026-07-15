import { getMagicNumber } from "@/lib/magicNumbers";

export type PriceProjectionInput = {
  currentPrice: number;
  projectedScore: number;
  previousScores: number[];
  round: number;
  gamesPlayed: number;
};

export type PriceProjectionResult = {
  projectedPrice: number;
  priceChange: number;
  breakEven: number | null;
  threeRoundAverage: number | null;
  magicNumber: number;
};

function roundUpToNearestHundred(value: number): number {
  return Math.ceil(value / 100) * 100;
}

export function calculateBreakEven(
  currentPrice: number,
  previousTwoScores: number[],
  magicNumber: number,
): number | null {
  if (previousTwoScores.length < 2) {
    return null;
  }

  const previousScoreTotal =
    previousTwoScores[0] + previousTwoScores[1];

  return (currentPrice * 12) / magicNumber - previousScoreTotal;
}

export function projectPrice({
  currentPrice,
  projectedScore,
  previousScores,
  round,
  gamesPlayed,
}: PriceProjectionInput): PriceProjectionResult {
  const magicNumber = getMagicNumber(round);
  const previousTwoScores = previousScores.slice(-2);

  const breakEven = calculateBreakEven(
    currentPrice,
    previousTwoScores,
    magicNumber,
  );

  if (gamesPlayed < 2 || previousTwoScores.length < 2) {
    return {
      projectedPrice: currentPrice,
      priceChange: 0,
      breakEven,
      threeRoundAverage: null,
      magicNumber,
    };
  }

  const threeRoundAverage =
    (previousTwoScores[0] +
      previousTwoScores[1] +
      projectedScore) /
    3;

  const rawPrice =
    (currentPrice * 3 +
      threeRoundAverage * magicNumber) /
    4;

  const projectedPrice =
    roundUpToNearestHundred(rawPrice);

  return {
    projectedPrice,
    priceChange: projectedPrice - currentPrice,
    breakEven,
    threeRoundAverage,
    magicNumber,
  };
}