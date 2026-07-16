import { calculatePrice } from "@/lib/priceEngine/calculatePrice";

export type ValidationPlayer = {
  startingPrice: number;
  previousScores: [number, number];
  actualScore: number;
  officialPrice: number;

  [key: string]: unknown;
};

export type ValidationResult = ValidationPlayer & {
  enginePrice: number;
  difference: number;
};

export function validatePlayer(
  player: ValidationPlayer,
  magicNumber: number,
): ValidationResult {
  const result = calculatePrice({
    currentPrice: player.startingPrice,
    previousScores: player.previousScores,
    projectedScore: player.actualScore,
    magicNumber,
  });

  return {
    ...player,
    enginePrice: result.projectedPrice,
    difference:
      result.projectedPrice - player.officialPrice,
  };
}