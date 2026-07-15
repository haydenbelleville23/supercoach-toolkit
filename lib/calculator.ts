export function projectPrice(
  currentPrice: number,
  breakEven: number,
  projectedScore: number,
): number {
  const temporaryMagicNumber = 4500;

  const estimatedChange =
    (projectedScore - breakEven) * temporaryMagicNumber;

  return Math.max(0, Math.round(currentPrice + estimatedChange));
}