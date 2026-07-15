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
};

export type SuperCoachPlayer = {
  id: number;
  first_name: string;
  last_name: string;
  active: boolean;
  injury_suspension_status: string | null;
  injury_suspension_status_text: string | null;
  team: SuperCoachTeam;
  positions: SuperCoachPosition[];
  player_stats: SuperCoachPlayerStats[];
};

opp?: {
  abbrev: string;
};

opp1?: {
  abbrev: string;
};

opp2?: {
  abbrev: string;
};

opp3?: {
  abbrev: string;
};

opph?: number;
opp1h?: number;
opp2h?: number;
opp3h?: number;