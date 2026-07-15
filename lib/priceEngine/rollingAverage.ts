export function rollingAverage(
  scores: number[],
): number {
  const lastThree = scores.slice(-3);

  if (lastThree.length === 0) {
    return 0;
  }

  return (
    lastThree.reduce(
      (total, score) => total + score,
      0,
    ) / lastThree.length
  );
}