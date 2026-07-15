import { getPlayers } from "@/lib/players";

export function saveSnapshot() {
  const players = getPlayers();

  // later:
  // write JSON to /history/2026/R18.json

  return players;
}