export function estimateMagicNumber(
  previousPrice: number,
  nextPrice: number,
  previousScores: [number, number],
  score: number,
) {
  const threeRoundAverage =
    (previousScores[0] +
      previousScores[1] +
      score) / 3;

  return (
    (nextPrice * 4 -
      previousPrice * 3) /
    threeRoundAverage
  );
}