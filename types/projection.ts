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
  opponent: string | null;
  homeAway: "H" | "A" | null;
  /** Matchup adjustment included in the projected score, shown beside the opponent. */
  matchupAdjustment?: number | null;
  /** A score the user typed in (it wins over the projection). */
  edited?: boolean;
};