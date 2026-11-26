/**
 * Builds data/2026/players-normalised.json: the normalised Player records
 * the app actually uses (about 2MB), so pages no longer bundle the raw
 * players-complete.json.
 *
 * Run after `npm run build:players` (it runs automatically as part of it):
 *   node scripts/build-players-normalised.ts
 *
 * Everything comes from public data: each player's price, games and
 * averages from their round-by-round history, and the breakeven for the
 * next round from our scaled engine (lib/supercoach/publicPlayerState.ts).
 * Every player that normalises is kept, sorted by name.
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import * as nodeModule from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { Player } from "../types/player";
import type { SuperCoachPlayer } from "../types/supercoach";

const SEASON = 2026;

const INPUT_FILE = path.resolve(`data/${SEASON}/players-complete.json`);
const FIXTURES_FILE = path.resolve(`data/${SEASON}/fixtures-raw.json`);
const OUTPUT_FILE = path.resolve(`data/${SEASON}/players-normalised.json`);

// lib/ uses extensionless relative imports, which Node does not resolve.
type ResolveHook = (
  specifier: string,
  context: { parentURL?: string },
  nextResolve: (
    specifier: string,
    context: { parentURL?: string },
  ) => unknown,
) => unknown;

const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: { resolve: ResolveHook }) => void;
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isLocal = specifier.startsWith(".") || specifier.startsWith("file:");

    if (isLocal && !path.extname(specifier) && context.parentURL) {
      const filePath = fileURLToPath(new URL(specifier, context.parentURL));

      if (existsSync(`${filePath}.ts`)) {
        return nextResolve(pathToFileURL(`${filePath}.ts`).href, context);
      }
    }

    return nextResolve(specifier, context);
  },
});

const { normaliseSuperCoachPlayer } = await import(
  "../lib/supercoach/normalisePlayer"
);
const { latestPricedRound, withScaledBreakevens } = await import(
  "../lib/supercoach/publicPlayerState"
);

async function main() {
  console.log("Building normalised player dataset");
  console.log("----------------------------------");

  const rawPlayers = JSON.parse(
    await readFile(INPUT_FILE, "utf8"),
  ) as SuperCoachPlayer[];

  const fixtures = JSON.parse(await readFile(FIXTURES_FILE, "utf8"));

  const normalised: Player[] = [];

  for (const rawPlayer of rawPlayers) {
    try {
      normalised.push(normaliseSuperCoachPlayer(rawPlayer));
    } catch (error) {
      console.warn(`Could not normalise player ${rawPlayer.id}:`, error);
    }
  }

  // The latest round with published prices, league-wide.
  const round = Math.max(
    ...normalised.map((player) => latestPricedRound(player) ?? -1),
  );

  const players = withScaledBreakevens(normalised, fixtures, round);

  players.sort((a, b) => a.name.localeCompare(b.name));

  const output = JSON.stringify(players);

  await writeFile(OUTPUT_FILE, output, "utf8");

  console.log(`Players: ${players.length}`);
  console.log(`Prices as of Round ${round}; breakevens for Round ${round + 1}`);
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
