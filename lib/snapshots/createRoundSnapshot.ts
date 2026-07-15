import type { Player } from "@/types/player";
import type {
  CompetitionRoundSnapshot,
  CompetitionSnapshotPlayer,
} from "@/types/competitionSnapshot";

function createSnapshotPlayer(
  player: Player,
): CompetitionSnapshotPlayer {
  return {
    playerId: player.id,
    name: player.name,
    team: player.team,
    price: player.price,
    gamesPlayed: player.games,
    scores: [...player.recentScores],
    active: player.active,
  };
}

export function createRoundSnapshot({
  players,
  season,
  round,
  observedSalaryPool,
}: {
  players: Player[];
  season: number;
  round: number;
  observedSalaryPool: number;
}): CompetitionRoundSnapshot {
  return {
    season,
    round,
    capturedAt: new Date().toISOString(),
    observedSalaryPool,
    players: players.map(createSnapshotPlayer),
  };
}