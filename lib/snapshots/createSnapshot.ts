import { getPlayers } from "@/lib/players";

import type { PlayerRecord } from "@/types/playerRecord";

export function createSnapshot(): PlayerRecord[] {
  const now = new Date().toISOString();

  return getPlayers().map((player) => ({
    player,
    lastUpdated: now,
    source: "supercoach",
  }));
}