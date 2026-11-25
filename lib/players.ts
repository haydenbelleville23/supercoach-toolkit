// Pre-normalised by scripts/build-players-normalised.ts (about 2MB). Importing
// the raw 129MB players-complete.json here bundled it into every page.
import normalisedPlayers from "@/data/2026/players-normalised.json";

import type { Player } from "@/types/player";

const players: Player[] = normalisedPlayers as unknown as Player[];

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
