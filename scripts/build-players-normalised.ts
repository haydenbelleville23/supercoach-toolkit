/**
 * Builds data/2026/players-normalised.json: the normalised Player records
 * the app actually uses (about 2MB), so pages no longer bundle the 129MB
 * raw players-complete.json.
 *
 * Run after `npm run build:players` (it runs automatically as part of it):
 *   node scripts/build-players-normalised.ts
 *
 * The output is the same list lib/players.ts used to produce at runtime:
 * every player that normalises, sorted by name.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import type { Player } from "../types/player";
import type { SuperCoachPlayer } from "../types/supercoach";

const SEASON = 2026;

const INPUT_FILE = path.resolve(`data/${SEASON}/players-complete.json`);
const OUTPUT_FILE = path.resolve(`data/${SEASON}/players-normalised.json`);

// normalisePlayer.ts only has type imports, so Node can load it directly.
// The path is a variable so TypeScript accepts the ".ts" extension.
const NORMALISE_MODULE = "../lib/supercoach/normalisePlayer.ts";

const { normaliseSuperCoachPlayer } = (await import(
  NORMALISE_MODULE
)) as typeof import("../lib/supercoach/normalisePlayer");

async function main() {
  console.log("Building normalised player dataset");
  console.log("----------------------------------");

  const rawPlayers = JSON.parse(
    await readFile(INPUT_FILE, "utf8"),
  ) as SuperCoachPlayer[];

  const players: Player[] = [];

  for (const rawPlayer of rawPlayers) {
    try {
      players.push(normaliseSuperCoachPlayer(rawPlayer));
    } catch (error) {
      console.warn(`Could not normalise player ${rawPlayer.id}:`, error);
    }
  }

  players.sort((a, b) => a.name.localeCompare(b.name));

  const output = JSON.stringify(players);

  await writeFile(OUTPUT_FILE, output, "utf8");

  console.log(`Players: ${players.length}`);
  console.log(
    `Size: ${(output.length / 1_000_000).toFixed(2)}MB -> ${path.relative(
      process.cwd(),
      OUTPUT_FILE,
    )}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
