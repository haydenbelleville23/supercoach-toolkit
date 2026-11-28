/**
 * Imports a season's fixtures from a CSV (no network requests).
 *
 *   npm run import:fixtures -- --season 2027 --file path/to/fixtures.csv
 *     [--allow-warnings] [--dry-run] [--force]
 *
 * Columns: round, home, away, venue, kickoff (ISO with an explicit offset,
 * e.g. 2027-03-11T19:30:00+11:00), notes (optional). Prints a report
 * (rounds, games per round and per team, byes per round and per team) and
 * writes data/{season}/fixtures-raw.json in the downloaded file's shape.
 *
 * Nothing is written when there are errors, or warnings without
 * --allow-warnings. An existing fixtures-raw.json is only replaced with
 * --force. See docs/new-season.md.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const { fixturesFile } = await import("../lib/season/dataSource");

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const season = Number(arg("season"));
const file = arg("file");

if (!Number.isInteger(season) || season < 2020 || !file) {
  console.error("Usage: npm run import:fixtures -- --season 2027 --file fixtures.csv [--allow-warnings] [--dry-run] [--force]");
  process.exit(1);
}

if (!existsSync(file)) {
  console.error(`No such file: ${file}`);
  process.exit(1);
}

const report = validateFixtureCsv(readFileSync(file, "utf8"), { season, firstRound: 0, finalRound: 24 });
console.log(formatImportReport(report));

if (report.errors.length > 0) {
  console.error(`\n${report.errors.length} error(s): nothing written.`);
  process.exit(1);
}

if (report.warnings.length > 0 && !flag("allow-warnings")) {
  console.error(`\n${report.warnings.length} warning(s): nothing written. Re-run with --allow-warnings to write anyway.`);
  process.exit(1);
}

const output = path.resolve(fixturesFile(season));

if (existsSync(output) && !flag("force")) {
  console.error(`\n${fixturesFile(season)} already exists: nothing written. Re-run with --force to replace it.`);
  process.exit(1);
}

const raw = toRawFixtureFile(report.games, {
  season,
  generatedAt: new Date().toISOString(),
  source: `CSV import (${path.basename(file)})`,
});

if (flag("dry-run")) {
  console.log(`\nDry run: would write ${fixturesFile(season)} (${report.games.length} games).`);
} else {
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(raw, null, 2)}\n`);
  console.log(`\nWrote ${fixturesFile(season)} (${report.games.length} games).`);
}
