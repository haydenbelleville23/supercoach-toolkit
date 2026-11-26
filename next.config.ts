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

const nextConfig: NextConfig = {
  // Inlined into server and browser code so both see the same round.
  env: {
    DEBUG_AS_OF_ROUND: asOfRound === null ? "" : String(asOfRound),
  },
  turbopack: {
    resolveAlias,
  },
};

export default nextConfig;
