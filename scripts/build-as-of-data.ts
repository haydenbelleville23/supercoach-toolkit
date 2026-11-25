/**
 * Writes the "as of Round N" data used by the DEBUG_AS_OF_ROUND lock:
 *
 *   .debug-data/round-N/players-normalised.json
 *   .debug-data/round-N/fixtures-raw.json
 *
 * next.config.ts runs this automatically when DEBUG_AS_OF_ROUND is set and
 * points the app's data imports at these files, so later rounds are never
 * bundled. It can also be run by hand:
 *
 *   node scripts/build-as-of-data.ts 10
 *
 * Reads local data only.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as nodeModule from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { Player } from "@/types/player";

const SEASON = 2026;
const ROOT = process.cwd();

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

const { parseAsOfRound } = await import("../lib/asOf/parseAsOfRound");
const { trimFixturesToRound, trimPlayersToRound } = await import(
  "../lib/asOf/trimToRound"
);

type RawFixtureFile = Parameters<typeof trimFixturesToRound>[0];

async function main() {
  const asOfRound = parseAsOfRound(process.argv[2]);

  if (asOfRound === null) {
    console.error("Usage: node scripts/build-as-of-data.ts <round>");
    process.exit(2);
  }

  const players = JSON.parse(
    await readFile(path.resolve(`data/${SEASON}/players-normalised.json`), "utf8"),
  ) as Player[];

  const fixtures = JSON.parse(
    await readFile(path.resolve(`data/${SEASON}/fixtures-raw.json`), "utf8"),
  ) as RawFixtureFile;

  const trimmedFixtures = trimFixturesToRound(fixtures, asOfRound);
  const trimmedPlayers = trimPlayersToRound(players, trimmedFixtures, asOfRound);

  const outputDir = path.join(ROOT, ".debug-data", `round-${asOfRound}`);
  await mkdir(outputDir, { recursive: true });

  await writeFile(
    path.join(outputDir, "players-normalised.json"),
    JSON.stringify(trimmedPlayers),
    "utf8",
  );
  await writeFile(
    path.join(outputDir, "fixtures-raw.json"),
    JSON.stringify(trimmedFixtures),
    "utf8",
  );

  console.log(
    `DEBUG_AS_OF_ROUND=${asOfRound}: ${trimmedPlayers.length} of ` +
      `${players.length} players existed after Round ${asOfRound} ` +
      `-> ${path.relative(ROOT, outputDir)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
