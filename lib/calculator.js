export function projectPrice(currentPrice, breakEven, projectedScore) {
  const magicNumber = 4500;

  const priceChange = (projectedScore - breakEven) * magicNumber;

  return Math.round(currentPrice + priceChange);
}