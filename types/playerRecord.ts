import type { Player } from "./player";

export type PlayerRecord = {
  player: Player;

  lastUpdated: string;

  source: "supercoach";
};