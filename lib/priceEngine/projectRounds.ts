import { calculateBreakEven } from "./calculateBreakEven";
import { calculatePrice } from "./calculatePrice";

export type RoundProjectionInput = {
  startingPrice: number;
  previousScores: [number, number];
  projectedScores: number[];
  startingRound: number;
  getMagicNumber: (round: number) => number;
};

export type RoundProjection = {
  round: number;
  score: number;
  breakEven: number;
  magicNumber: number;
  threeRoundAverage: number;
  price: number;
  change: number;
};

export function projectRounds({
  startingPrice,
  previousScores,
  projectedScores,
  startingRound,
  getMagicNumber,
}: RoundProjectionInput): RoundProjection[] {
  let currentPrice = startingPrice;
  let rollingScores: [number, number] = [...previousScores];

  return projectedScores.map((score, index) => {
    const round = startingRound + index;
    const magicNumber = getMagicNumber(round);

    const breakEven = calculateBreakEven({
      currentPrice,
      previousScores: rollingScores,
      magicNumber,
    });

    const priceResult = calculatePrice({
      currentPrice,
      previousScores: rollingScores,
      projectedScore: score,
      magicNumber,
    });

    const result: RoundProjection = {
      round,
      score,
      breakEven,
      magicNumber,
      threeRoundAverage: priceResult.threeRoundAverage,
      price: priceResult.projectedPrice,
      change: priceResult.priceChange,
    };

    currentPrice = priceResult.projectedPrice;
    rollingScores = [rollingScores[1], score];

    return result;
  });
}