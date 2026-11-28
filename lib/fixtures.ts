// The shown season's fixtures: next.config.ts points this import at
// data/{season}/fixtures-raw.json, the debug sample or a no-fixtures stub
// (see lib/season/dataSource.ts). For 2026 it is this exact file.
import rawFixtureData from "@/data/2026/fixtures-raw.json";
import { DEBUG_AS_OF_ROUND } from "@/lib/asOf/debugAsOfRound";
import {
  trimFixturesToRound,
  type RawFixtureFile as AsOfFixtureFile,
} from "@/lib/asOf/trimToRound";

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
  /** True for the invented sample (DEBUG_SEASON only). */
  sample?: boolean;
  /** True for the no-fixtures stub. */
  noFixtures?: boolean;
};

// Under DEBUG_AS_OF_ROUND the build already imports trimmed data (see
// next.config.ts); trimming again here is a no-op there and keeps scripts
// and tests that import this module locked too.
const fixtureFile: RawFixtureFile =
  DEBUG_AS_OF_ROUND === null
    ? (rawFixtureData as RawFixtureFile)
    : (trimFixturesToRound(
        rawFixtureData as unknown as AsOfFixtureFile,
        DEBUG_AS_OF_ROUND,
      ) as unknown as RawFixtureFile);

/** The season the loaded fixtures are for (null: no fixtures loaded). */
export const FIXTURES_SEASON: number | null =
  fixtureFile.noFixtures === true ? null : Number(fixtureFile.season);

/** True when the fixtures are the invented sample (DEBUG_SEASON only). */
export const FIXTURES_ARE_SAMPLE = fixtureFile.sample === true;

/** The fixture file as the app sees it (trimmed under the debug lock). */
export function getRawFixtureFile(): AsOfFixtureFile {
  return fixtureFile as unknown as AsOfFixtureFile;
}

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