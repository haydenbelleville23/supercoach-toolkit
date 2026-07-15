export type Player = {
  id: number;
  name: string;
  team: string;
  teamName: string;
  positions: string[];
  price: number;
  average: number;
  average3: number;
  average5: number;
  breakeven: number;
  projectedScore: number;
  projectedScores: number[];
  projectedPrices: number[];
  projectedPriceChanges: number[];
  ownership: number;
  active: boolean;
  availability: string | null;
};