export type CalculateBreakEvenInput = {
  currentPrice: number;
  previousScores: [number, number];
  magicNumber: number;
};

export function calculateBreakEven({
  currentPrice,
  previousScores,
  magicNumber,
}: CalculateBreakEvenInput): number {
  const previousScoresTotal =
    previousScores[0] + previousScores[1];

  const rawBreakEven =
    (currentPrice * 12) / magicNumber - previousScoresTotal;

  return Math.ceil(rawBreakEven);
}