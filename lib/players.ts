import rawPlayers from "@/data/2026/players-complete.json";
import { normaliseSuperCoachPlayer } from "@/lib/supercoach/normalisePlayer";

import type { Player } from "@/types/player";
import type { SuperCoachPlayer } from "@/types/supercoach";

const players: Player[] = (
  rawPlayers as unknown as SuperCoachPlayer[]
)
  .map((rawPlayer) => {
    try {
      return normaliseSuperCoachPlayer(rawPlayer);
    } catch (error) {
      console.warn(
        `Could not normalise player ${rawPlayer.id}:`,
        error,
      );

      return null;
    }
  })
  .filter((player): player is Player => player !== null)
  .sort((a, b) => a.name.localeCompare(b.name));

export function getPlayers(): Player[] {
  return players;
}

export function getPlayerById(
  playerId: number,
): Player | undefined {
  return players.find(
    (player) => player.id === playerId,
  );
}