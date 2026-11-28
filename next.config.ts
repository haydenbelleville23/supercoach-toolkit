import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

import type { NextConfig } from "next";

import { parseAsOfRound } from "./lib/asOf/parseAsOfRound";
import {
  AVAILABILITY_FILE,
  AVAILABILITY_FIXTURE_FILE,
  AVAILABILITY_SPECIFIER,
  availabilitySource,
} from "./lib/availability/alias";
import {
  LIVE_SAMPLE_FIXTURE_FILE,
  LIVE_SAMPLE_SPECIFIER,
  liveSampleSource,
} from "./lib/liveMatch/sampleAlias";
import {
  BASE_DATA_SEASON,
  fixturesFile,
  fixturesSource,
  playersFile,
  playersSeason,
} from "./lib/season/dataSource";
import { DEBUG_SEASON, SEASON_YEAR } from "./lib/season/seasonYear";

/**
 * DEBUG_AS_OF_ROUND=N shows the site as it was straight after Round N.
 * Unset (the default, and on Vercel) changes nothing.
 *
 * When set, the trimmed data is written to .debug-data/round-N and the
 * app's two data imports are pointed at it, so later rounds are never
 * bundled for the browser or the server. Turbopack only (the Next 16
 * default for dev and build).
 */
const asOfRound = parseAsOfRound(process.env.DEBUG_AS_OF_ROUND);

const resolveAlias: Record<string, string> = {};

if (asOfRound !== null && DEBUG_SEASON !== null) {
  throw new Error("Set DEBUG_AS_OF_ROUND or DEBUG_SEASON, not both.");
}

/**
 * Season data (see lib/season/dataSource.ts). For the committed season
 * (2026) nothing is aliased, so production reads exactly what it did.
 * For another season (ACTIVE_SEASON changed, or DEBUG_SEASON locally) the
 * two data imports point at that season's files.
 */
const playersDataSeason =
  playersSeason({ season: SEASON_YEAR, exists: existsSync }) ?? BASE_DATA_SEASON;

if (SEASON_YEAR !== BASE_DATA_SEASON) {
  resolveAlias[`@/${fixturesFile(BASE_DATA_SEASON)}`] = `./${fixturesSource({
    season: SEASON_YEAR,
    debugSeason: DEBUG_SEASON,
    exists: existsSync,
  })}`;
}

if (playersDataSeason !== BASE_DATA_SEASON) {
  resolveAlias[`@/${playersFile(BASE_DATA_SEASON)}`] = `./${playersFile(playersDataSeason)}`;
}

if (asOfRound !== null) {
  execFileSync(
    process.execPath,
    ["scripts/build-as-of-data.ts", String(asOfRound)],
    { stdio: "inherit" },
  );

  const dir = `./.debug-data/round-${asOfRound}`;

  resolveAlias["@/data/2026/players-normalised.json"] =
    `${dir}/players-normalised.json`;
  resolveAlias["@/data/2026/fixtures-raw.json"] = `${dir}/fixtures-raw.json`;
}

// Availability: the weekly file, the invented sample (debug lock only) or
// a no-data stub. See lib/availability/alias.ts.
resolveAlias[AVAILABILITY_SPECIFIER] = `./${availabilitySource({
  asOfRound,
  fileExists: existsSync(AVAILABILITY_FILE),
  fixtureExists: existsSync(AVAILABILITY_FIXTURE_FILE),
})}`;

// Live page sample feed: the invented sample (debug lock only) or a
// no-data stub. See lib/liveMatch/sampleAlias.ts.
resolveAlias[LIVE_SAMPLE_SPECIFIER] = `./${liveSampleSource({
  asOfRound,
  fixtureExists: existsSync(LIVE_SAMPLE_FIXTURE_FILE),
})}`;

const nextConfig: NextConfig = {
  // The results archive reads one round file per request with fs, which
  // the tracer can't see, so ship every season's games/ files with the
  // Live routes (all small JSON).
  outputFileTracingIncludes: {
    "/live/**": ["./data/*/games/*.json"],
  },
  // Inlined into server and browser code so both see the same round.
  env: {
    DEBUG_AS_OF_ROUND: asOfRound === null ? "" : String(asOfRound),
    DEBUG_SEASON: DEBUG_SEASON === null ? "" : String(DEBUG_SEASON),
    PLAYERS_DATA_SEASON: String(playersDataSeason),
  },
  turbopack: {
    resolveAlias,
  },
};

export default nextConfig;
