import { getMagicNumber } from "@/lib/magicNumbers";

import { calculateBreakEven } from "./calculateBreakEven";
import { calculatePrice } from "./calculatePrice";

import type {
  PlayerState,
  RoundResult,
} from "./types";

export function simulateRound(
  state: PlayerState,
  projectedScore: number,
): RoundResult {
  const updatedScores = [
    ...state.scores,
    projectedScore,
  ];

  const previousScores = updatedScores.slice(
    -3,
    -1,
  ) as [number, number];

  const magicNumber = getMagicNumber(
    state.currentRound + 1,
  );

  const breakEven = calculateBreakEven({
    currentPrice: state.price,
    previousScores,
    magicNumber,
  });

  const priceResult = calculatePrice({
    currentPrice: state.price,
    previousScores,
    projectedScore,
    magicNumber,
  });

  return {
    rawPrice: priceResult.rawProjectedPrice,
    price: priceResult.projectedPrice,
    priceChange: priceResult.priceChange,
    breakEven,
    threeRoundAverage: priceResult.threeRoundAverage,
    magicNumber,

    state: {
      currentRound: state.currentRound + 1,
      price: priceResult.projectedPrice,
      scores: updatedScores,
    },
  };
}