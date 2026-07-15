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
  if (magicNumber <= 0) {
    throw new Error("Magic Number must be greater than zero.");
  }

  const previousScoresTotal =
    previousScores[0] + previousScores[1];

  const rawBreakEven =
    (currentPrice * 3) / magicNumber -
    previousScoresTotal;

  return Math.ceil(rawBreakEven);
}