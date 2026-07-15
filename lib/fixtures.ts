import rawFixtureData from "@/data/2026/fixtures-raw.json";

import type {
  PlayerFixture,
  TeamFixture,
} from "@/types/fixture";

type RawFixtureTeam = {
  id: number;
  abbrev: string;
  name: string;
};

type RawFixture = {
  id: number;
  season: string;
  kickoff?: string | null;
  team1: RawFixtureTeam;
  team2: RawFixtureTeam;
  location?: string | null;
  round: number;
};

type RawFixtureRound = {
  round: number;
  response: RawFixture[];
};

type RawFixtureFile = {
  season: number;
  downloadedAt: string;
  rounds: RawFixtureRound[];
};

const fixtureFile = rawFixtureData as RawFixtureFile;

const fixtures: TeamFixture[] = fixtureFile.rounds.flatMap(
  (roundEntry) =>
    roundEntry.response.map((fixture) => ({
      id: fixture.id,
      round: fixture.round,
      kickoff: fixture.kickoff ?? null,
      homeTeam: fixture.team1.abbrev,
      awayTeam: fixture.team2.abbrev,
      location: fixture.location ?? null,
    })),
);

export function getFixtures(): TeamFixture[] {
  return fixtures;
}

export function getTeamFixture(
  team: string,
  round: number,
): PlayerFixture | null {
  const fixture = fixtures.find(
    (item) =>
      item.round === round &&
      (item.homeTeam === team ||
        item.awayTeam === team),
  );

  if (!fixture) {
    return null;
  }

  const isHomeTeam = fixture.homeTeam === team;

  return {
    round,
    opponent: isHomeTeam
      ? fixture.awayTeam
      : fixture.homeTeam,
    homeAway: isHomeTeam ? "H" : "A",
    location: fixture.location,
  };
}