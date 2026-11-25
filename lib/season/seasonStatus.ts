import type { Player } from "@/types/player";

export interface SeasonFixture {
  round: number;
  homeTeam: string;
  awayTeam: string;
  kickoff: string | null;
}


/**
 * Latest round in which every team with a fixture has at least one player
 * score in the data. Returns null if no round is complete yet.
 */
export function getLatestCompletedRound(
  players: Player[],
  fixtures: SeasonFixture[],
): number | null {
  const teamsScored = new Set<string>();

  for (const player of players) {
    for (const row of player.history) {
      if (row.games > 0) {
        teamsScored.add(`${row.round}:${player.team}`);
      }
    }
  }

  const rounds = [...new Set(fixtures.map((f) => f.round))].sort(
    (a, b) => a - b,
  );

  let latest: number | null = null;

  for (const round of rounds) {
    const teams = fixtures
      .filter((f) => f.round === round)
      .flatMap((f) => [f.homeTeam, f.awayTeam]);

    if (
      teams.length > 0 &&
      teams.every((team) => teamsScored.has(`${round}:${team}`))
    ) {
      latest = round;
    }
  }

  return latest;
}
