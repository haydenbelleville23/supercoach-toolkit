import type { Player } from "@/types/player";

export interface SeasonFixture {
  round: number;
  homeTeam: string;
  awayTeam: string;
  kickoff: string | null;
}

/** How long after a round's last kickoff it still counts as "to come". */
const ROUND_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

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

/**
 * True when there is nothing left to project: no fixtures after the
 * completed round, or every remaining round's games kicked off more than
 * a week ago (the data has not been updated since the season ended).
 */
export function isOffseason(
  fixtures: SeasonFixture[],
  completedRound: number,
  now: Date = new Date(),
): boolean {
  const remaining = fixtures.filter((f) => f.round > completedRound);

  if (remaining.length === 0) {
    return true;
  }

  const latestKickoff = Math.max(
    ...remaining.map((f) =>
      f.kickoff ? Date.parse(f.kickoff) : Number.POSITIVE_INFINITY,
    ),
  );

  return latestKickoff + ROUND_GRACE_MS < now.getTime();
}
