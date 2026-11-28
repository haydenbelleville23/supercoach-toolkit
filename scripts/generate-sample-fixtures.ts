/**
 * Writes data/{season}/fixtures.sample.json: an INVENTED fixture for
 * testing a new season locally (npm run dev:2027). It's only loaded with
 * DEBUG_SEASON set to that season and no real fixtures in place, and is
 * labelled "Sample fixtures (invented, for testing)" wherever shown.
 *
 *   npm run generate:sample-fixtures            # 2027
 *   npm run generate:sample-fixtures -- --season 2028
 *
 * No network requests. The sample is checked with the fixture importer's
 * validation before it's written.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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

const { formatImportReport, toRawFixtureFile, validateFixtureCsv } = await import("../lib/season/fixtureImport");
const { generateSampleGames, sampleGamesCsv, SAMPLE_MARKER } = await import("../lib/season/sampleFixtures");
const { sampleFixturesFile } = await import("../lib/season/dataSource");

const index = process.argv.indexOf("--season");
const season = index === -1 ? 2027 : Number(process.argv[index + 1]);

const games = generateSampleGames(season);
const report = validateFixtureCsv(sampleGamesCsv(games), { season, firstRound: 0, finalRound: 24 });
console.log(formatImportReport(report));

if (report.errors.length > 0 || report.warnings.length > 0) {
  console.error("The generated sample didn't pass the importer's checks: nothing written.");
  process.exit(1);
}

const file = {
  ...toRawFixtureFile(games, {
    season,
    // Fixed, so re-running changes nothing.
    generatedAt: `${season}-01-01T00:00:00.000Z`,
    source: "generated sample",
  }),
  sample: true,
  note: `${SAMPLE_MARKER}: made-up ${season} fixtures for testing (DEBUG_SEASON only). Not the real AFL fixture.`,
};

const output = path.resolve(sampleFixturesFile(season));
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(file, null, 1)}\n`);
console.log(`Wrote ${sampleFixturesFile(season)} (${games.length} games).`);
