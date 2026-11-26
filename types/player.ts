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
  championDataId: string | null;
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

  /** Our scaled engine's breakeven for the next round (0 if none). */
  breakeven: number;

  /**
   * Percentage of teams that own the player. No public source is wired in
   * yet, so this is null for every player and the UI hides it.
   */
  ownership: number | null;

  /**
   * Games played in the previous season (public per-player record).
   * 0 for a debutant, which projectScore uses for the pre-debut 50 rule.
   */
  previousGames: number;

  active: boolean;
  availability: string | null;
};