import { normalisedSamplePlayer } from "@/lib/supercoach/sample";
import type { Player } from "@/types/player";

const players: Player[] = [
  {
    ...normalisedSamplePlayer,
    recentScores: [96, 107],
  },
];

export function getPlayers(): Player[] {
  return players;
}

export function getPlayerById(playerId: number): Player | undefined {
  return players.find((player) => player.id === playerId);
}