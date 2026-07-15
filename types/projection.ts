export type SeasonProjectionRow = {
  round: number;
  played: boolean;
  isActual: boolean;
  score: number | null;
  magicNumber: number;
  breakEven: number | null;
  price: number | null;
  priceChange: number | null;
  threeRoundAverage: number | null;
};