import playerData from "@/data/players.json";
import type { Player } from "@/types/player";

export function getPlayers(): Player[] {
  return playerData;
}

export function getPlayerById(playerId: number): Player | undefined {
  return getPlayers().find((player) => player.id === playerId);
}