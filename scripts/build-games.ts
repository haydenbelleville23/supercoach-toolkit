/**
 * Builds the results archive: data/{season}/games/round-NN.json for each
 * completed round, plus index.json, from local files only
 * (fixtures-raw.json and player-details/). No network requests.
 *
 *   npm run build:games              # new rounds only
 *   npm run build:games -- --refresh # rebuild every completed round
 *
 * Re-running changes nothing unless the data changed. Players who can't be
 * linked to a game are listed and skipped.
 */

import { existsSync } from "node:fs";
import * as nodeModule from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.cwd();

type ResolveHook = (
  specifier: string,
  context: { parentURL?: string },
  nextResolve: (specifier: string, context: { parentURL?: string }) => unknown,
) => unknown;

const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: { resolve: ResolveHook }) => void;
};

// lib/ uses "@/..." and extensionless imports, which Node doesn't resolve.
registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = specifier;
    if (target.startsWith("@/")) {
      target = pathToFileURL(path.join(ROOT, target.slice(2))).href;
    }
    const isLocal = target.startsWith(".") || target.startsWith("file:");
    if (isLocal && !path.extname(target) && context.parentURL) {
      const filePath = fileURLToPath(new URL(target, context.parentURL));
      for (const extension of [".ts", ".tsx"]) {
        if (existsSync(filePath + extension)) {
          return nextResolve(pathToFileURL(filePath + extension).href, context);
        }
      }
    }
    return nextResolve(target, context);
  },
});

const { SEASON_YEAR } = await import("../lib/season/seasonYear");
const { writeGamesFiles } = await import("../lib/games/writeGames");

const refresh = process.argv.includes("--refresh");

try {
  const result = writeGamesFiles({ season: SEASON_YEAR, dataDir: path.join(ROOT, "data"), refresh });

  console.log(`Season ${SEASON_YEAR}: ${result.completedRounds.length} completed round(s).`);
  console.log(`  written:   ${result.written.join(", ") || "none"}`);
  console.log(`  unchanged: ${result.unchanged.join(", ") || "none"}`);
  console.log(`  kept:      ${result.kept.join(", ") || "none"}${result.kept.length ? " (use --refresh to rebuild)" : ""}`);

  if (result.problems.length > 0) {
    console.log(`\n${result.problems.length} player game(s) couldn't be linked and were skipped:`);
    for (const problem of result.problems) console.log(`  ${problem}`);
  } else {
    console.log("  Every player game linked.");
  }
} catch (error) {
  console.error(`build:games failed: ${(error as Error).message}`);
  process.exit(1);
}
