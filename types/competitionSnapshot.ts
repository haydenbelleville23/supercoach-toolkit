export type CompetitionSnapshotPlayer = {
  playerId: number;
  name: string;
  team: string;

  price: number;
  gamesPlayed: number;
  scores: number[];

  active: boolean;
};

export type CompetitionRoundSnapshot = {
  season: number;
  round: number;
  capturedAt: string;

  observedSalaryPool: number;
  players: CompetitionSnapshotPlayer[];
};