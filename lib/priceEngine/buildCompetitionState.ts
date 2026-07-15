import type { Player } from "@/types/player";
import type { CompetitionPlayerState } from "./calculateRoundMagicNumber";

export function buildCompetitionState(
  players: Player[],
  projectionIndex = 0,
): CompetitionPlayerState[] {
  return players.map((player) => ({
    price: player.price,
    gamesPlayed: player.games,
    recentScores: [...player.recentScores],
    projectedScore:
      player.projectedScores[projectionIndex] ?? null,
    active: player.active,
  }));
}