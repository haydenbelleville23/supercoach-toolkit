export type PlayerHistoryRow = {
  round: number;
  score: number | null;
  price: number | null;
  priceChange: number | null;
  games: number;
  opponent: string | null;
  homeAway: "H" | "A" | null;
};

export type Player = {
  id: number;
  name: string;

  team: string;
  teamName: string;

  positions: string[];

  price: number;
  games: number;

  average: number;
  average3: number;
  average5: number;

  recentScores: number[];
  history: PlayerHistoryRow[];

  breakeven: number;

  projectedBreakEvens: number[];

  projectedScore: number;
  projectedScores: number[];

  projectedPrices: number[];
  projectedPriceChanges: number[];

  ownership: number;

  active: boolean;
  availability: string | null;

  upcomingFixtures: {
    round: number;
    opponent: string;
    homeAway: "H" | "A";
  }[];
};