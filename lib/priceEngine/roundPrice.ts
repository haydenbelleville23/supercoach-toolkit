export function roundPriceUp(value: number): number {
  return Math.ceil(value / 100) * 100;
}