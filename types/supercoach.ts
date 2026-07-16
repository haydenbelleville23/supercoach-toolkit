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

export type SuperCoachPlayerStats = {
  player_id: number;
  round: number;

  points: number;
  price: number;
  total_points: number;
  total_games: number;

  price_change: number;
  total_price_change: number;

  avg: number;
  avg3: number;
  avg5: number;

  be1: number;
  be2: number;
  be3: number;

  ppts: number;
  ppts1: number;
  ppts2: number;
  ppts3: number;

  pp1: number;
  pp2: number;
  pp3: number;

  ppc1: number;
  ppc2: number;
  ppc3: number;

  own: number;

  opp?: SuperCoachOpponent | null;
  opp1?: SuperCoachOpponent | null;
  opp2?: SuperCoachOpponent | null;
  opp3?: SuperCoachOpponent | null;

  opph?: number | null;
  opp1h?: number | null;
  opp2h?: number | null;
  opp3h?: number | null;
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

  active: boolean;

  injury_suspension_status: string | null;
  injury_suspension_status_text: string | null;

  team: SuperCoachTeam;
  positions: SuperCoachPosition[];

  player_stats: SuperCoachPlayerStats[];
  player_match_stats?: SuperCoachPlayerMatchStat[];
  player_stat_history?: SuperCoachPlayerStatHistory[];
};