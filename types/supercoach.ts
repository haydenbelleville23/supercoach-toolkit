export type SuperCoachPosition = {
  position: string;
  position_long: string;
  sort: number;
};

export type SuperCoachTeam = {
  id: number;
  abbrev: string;
  name: string;
};

export type SuperCoachOpponent = {
  id?: number;
  abbrev: string;
  name?: string;
};

export type SuperCoachPlayerMatchStat = {
  player_id: number;
  fixture_id: number;
  round: number;
  points: number;
  games: number;
  minutes_played: number;
};

export type SuperCoachPlayerStatHistory = {
  player_id: number;
  round: number;

  points?: number | null;
  price?: number | null;
  price_change?: number | null;

  games?: number | null;
  total_games?: number | null;

  opp?: SuperCoachOpponent | null;
  opph?: number | null;
};

export type SuperCoachPlayer = {
  id: number;
  feed_id: string | null;
  first_name: string;
  last_name: string;

  /** Games in the previous season (public). */
  previous_games?: number | null;

  /** Average in the previous season (public). */
  previous_average?: number | null;

  active: boolean;

  injury_suspension_status: string | null;
  injury_suspension_status_text: string | null;

  team: SuperCoachTeam;
  positions: SuperCoachPosition[];

  player_match_stats?: SuperCoachPlayerMatchStat[];
  /** The public detail endpoint's player_stats: one record per round. */
  player_stat_history?: SuperCoachPlayerStatHistory[];
};