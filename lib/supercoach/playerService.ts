import type { Player } from "@/types/player";
import { normaliseSuperCoachPlayer } from "./normalisePlayer";
import type { SuperCoachPlayer } from "@/types/supercoach";

export function buildPlayerDatabase(
  rawPlayers: SuperCoachPlayer[],
): Player[] {
  return rawPlayers.map(normaliseSuperCoachPlayer);
}