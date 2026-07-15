import { roundPriceUp } from "./roundPrice";

export type CalculatePriceInput = {
  currentPrice: number;
  previousScores: [number, number];
  projectedScore: number;
  magicNumber: number;
};

export type CalculatePriceResult = {
  rawProjectedPrice: number;
  projectedPrice: number;
  priceChange: number;
  threeRoundAverage: number;
};

export function calculatePrice({
  currentPrice,
  previousScores,
  projectedScore,
  magicNumber,
}: CalculatePriceInput): CalculatePriceResult {
  const threeRoundAverage =
    (previousScores[0] + previousScores[1] + projectedScore) / 3;

  const rawProjectedPrice =
    (currentPrice * 3 + threeRoundAverage * magicNumber) / 4;

  const projectedPrice = roundPriceUp(rawProjectedPrice);

  return {
    rawProjectedPrice,
    projectedPrice,
    priceChange: projectedPrice - currentPrice,
    threeRoundAverage,
  };
}