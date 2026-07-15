export type TeamFixture = {
  id: number;
  round: number;
  kickoff: string | null;

  homeTeam: string;
  awayTeam: string;

  location: string | null;
};

export type PlayerFixture = {
  round: number;
  opponent: string;
  homeAway: "H" | "A";
  location: string | null;
};