// Pre-normalised by scripts/build-players-normalised.ts (about 2MB). Importing
// the raw 129MB players-complete.json here bundled it into every page.
import normalisedPlayers from "@/data/2026/players-normalised.json";
import { DEBUG_AS_OF_ROUND } from "@/lib/asOf/debugAsOfRound";
import { trimPlayersToRound } from "@/lib/asOf/trimToRound";
import { getRawFixtureFile } from "@/lib/fixtures";

import type { Player } from "@/types/player";

// Under DEBUG_AS_OF_ROUND the build already imports trimmed data (see
// next.config.ts), so later rounds never reach the browser; trimming again
// here changes nothing there and keeps scripts and tests locked too.
const players: Player[] =
  DEBUG_AS_OF_ROUND === null
    ? (normalisedPlayers as unknown as Player[])
    : trimPlayersToRound(
        normalisedPlayers as unknown as Player[],
        getRawFixtureFile(),
        DEBUG_AS_OF_ROUND,
      );

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
