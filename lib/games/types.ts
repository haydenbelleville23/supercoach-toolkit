/** One side of a game's final score. */
export interface GameTeamScore {
  /** Club code, e.g. "ADE". */
  team: string;
  /** Club name as the fixture gives it, e.g. "Adelaide". */
  teamName: string;
  goals: number;
  behinds: number;
  total: number;
}

/** One player's game, from SuperCoach's public per-player data. */
export interface GamePlayer {
  id: number;
  name: string;
  team: string;
  positions: string[];
  /** SuperCoach score. */
  score: number;
  minutes: number | null;
  /** Time on ground %, or null when the data doesn't have it. */
  tog: number | null;
  kicks: number | null;
  handballs: number | null;
  /** kicks + handballs (null if either is missing). */
  disposals: number | null;
  marks: number | null;
  tackles: number | null;
  hitouts: number | null;
  goals: number | null;
  behinds: number | null;
  /** That round's published price and change, or null. */
  price: number | null;
  priceChange: number | null;
}

export interface Game {
  /** "{season}-{round}-{home}-{away}", lowercase codes: "2026-5-ade-car". */
  id: string;
  season: number;
  round: number;
  /** SuperCoach's fixture id (for linking only). */
  fixtureId: number;
  venue: string;
  /** ISO time with its offset, as published: "2026-04-09T19:40:00+10:00". */
  kickoff: string;
  home: GameTeamScore;
  away: GameTeamScore;
  /** home total - away total (negative when the away side won). */
  margin: number;
  /** Winning club code, or null for a draw. */
  winner: string | null;
  /** Quarter scores aren't in the public fixture data, so always null. */
  quarters: null;
  players: { home: GamePlayer[]; away: GamePlayer[] };
}

/** data/{season}/games/round-NN.json */
export interface RoundGamesFile {
  season: number;
  round: number;
  games: Game[];
}

/** data/{season}/games/index.json */
export interface GamesIndex {
  season: number;
  /** Rounds with a file, ascending. */
  rounds: number[];
  /** Games per round, for the selector. */
  gameCounts: Record<string, number>;
}
