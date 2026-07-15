import type { CompetitionRoundSnapshot } from "@/types/competitionSnapshot";

export function findAddedPlayers(
  previousSnapshot: CompetitionRoundSnapshot,
  currentSnapshot: CompetitionRoundSnapshot,
) {
  const previousPlayerIds = new Set(
    previousSnapshot.players.map(
      (player) => player.playerId,
    ),
  );

  return currentSnapshot.players.filter(
    (player) => !previousPlayerIds.has(player.playerId),
  );
}