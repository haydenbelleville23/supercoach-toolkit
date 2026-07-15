import { calculatePrice } from "@/lib/priceEngine/calculatePrice";

export function validatePlayer(player, magicNumber: number) {
  const result = calculatePrice({
    currentPrice: player.startingPrice,
    previousScores: player.previousScores,
    projectedScore: player.actualScore,
    magicNumber,
  });

  return {
    ...player,
    enginePrice: result.projectedPrice,
    difference: result.projectedPrice - player.officialPrice,
  };
}