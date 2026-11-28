/**
 * Which files the app's season data comes from. next.config.ts points the
 * two data imports (lib/fixtures.ts and lib/players.ts) at them, so a
 * normal build never bundles the invented sample.
 *
 * Fixtures for the shown season:
 * - data/{season}/fixtures-raw.json when it exists;
 * - else, only with DEBUG_SEASON set to that season, the invented sample
 *   data/{season}/fixtures.sample.json;
 * - else no fixtures (lib/season/no-fixtures.json).
 *
 * Players: data/{season}/players-normalised.json when it exists, else the
 * latest earlier season's (a new season's preseason uses last season's
 * final data, for Fixture Difficulty only).
 */
export const BASE_DATA_SEASON = 2026;

export const fixturesFile = (season: number) => `data/${season}/fixtures-raw.json`;
export const sampleFixturesFile = (season: number) => `data/${season}/fixtures.sample.json`;
export const playersFile = (season: number) => `data/${season}/players-normalised.json`;
export const NO_FIXTURES_FILE = "lib/season/no-fixtures.json";

export function fixturesSource({
  season,
  debugSeason,
  exists,
}: {
  season: number;
  debugSeason: number | null;
  exists: (file: string) => boolean;
}): string {
  if (exists(fixturesFile(season))) return fixturesFile(season);
  if (debugSeason === season && exists(sampleFixturesFile(season))) return sampleFixturesFile(season);
  return NO_FIXTURES_FILE;
}

/** The season whose players file is used: this one, or the latest earlier one. */
export function playersSeason({
  season,
  exists,
}: {
  season: number;
  exists: (file: string) => boolean;
}): number | null {
  for (let year = season; year >= BASE_DATA_SEASON; year -= 1) {
    if (exists(playersFile(year))) return year;
  }
  return null;
}

/**
 * The season of the players data the app loaded. next.config.ts inlines it;
 * tests and scripts read the 2026 file directly.
 */
export const PLAYERS_DATA_SEASON: number = Number(process.env.PLAYERS_DATA_SEASON) || BASE_DATA_SEASON;
