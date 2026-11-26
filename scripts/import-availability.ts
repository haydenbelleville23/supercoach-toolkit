/**
 * Weekly availability import (manual; not part of update:weekly).
 *
 *   npm run import:availability -- --file path/to/list.csv [--asOf 2026-05-19]
 *     [--source "AFL injury list"] [--dry-run] [--allow-unmatched]
 *
 * Reads a CSV, or text pasted from a table (tab- or pipe-separated), with
 * columns: player, team, injury, estimated return, and optionally selected
 * (yes/no/blank) and status (an override). Matches each row to a player by
 * name plus team. Unmatched or ambiguous rows are listed with suggestions
 * and nothing is written, unless --allow-unmatched.
 *
 * Players with no row fall back to SuperCoach's own public fields
 * (data/2026/player-details); every distinct value seen is printed.
 *
 * Writes data/2026/availability.json (never edit it by hand). Local files
 * only: no network requests. See docs/availability.md.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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

const { AVAILABILITY_FILE, AVAILABILITY_SEASON } = await import("../lib/availability/alias");
const { diffSnapshots, importAvailabilityList, listRoundFor, summariseByStatus } = await import(
  "../lib/availability/importList"
);
const { validateAvailability } = await import("../lib/availability/validate");
type Snapshot = import("../lib/availability/types").AvailabilitySnapshot;
type SuperCoachStatus = import("../lib/availability/importList").SuperCoachStatus;

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const file = arg("file");
const dryRun = flag("dry-run");
const allowUnmatched = flag("allow-unmatched");
const source = arg("source") ?? "Weekly injury list (manual import)";
const asOf =
  arg("asOf") ??
  new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(new Date());

if (!file) {
  console.error("Usage: npm run import:availability -- --file list.csv [--asOf YYYY-MM-DD] [--source \"...\"] [--dry-run] [--allow-unmatched]");
  process.exit(1);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
  console.error(`--asOf must be YYYY-MM-DD (got "${asOf}").`);
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`No such file: ${file}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Inputs (local files only)
// ---------------------------------------------------------------------------

const players = JSON.parse(
  readFileSync(path.join(ROOT, `data/${AVAILABILITY_SEASON}/players-normalised.json`), "utf8"),
) as { id: number; name: string; team: string; teamName: string; positions: string[] }[];

const fixturesRaw = JSON.parse(
  readFileSync(path.join(ROOT, `data/${AVAILABILITY_SEASON}/fixtures-raw.json`), "utf8"),
) as { rounds: { round: number; response: { kickoff: string }[] }[] };
const fixtures = fixturesRaw.rounds.flatMap((r) => r.response.map((g) => ({ round: r.round, kickoff: g.kickoff })));

const detailsDir = path.join(ROOT, `data/${AVAILABILITY_SEASON}/player-details`);
const superCoach: SuperCoachStatus[] = existsSync(detailsDir)
  ? readdirSync(detailsDir)
      .filter((name) => /^\d+\.json$/.test(name))
      .map((name) => {
        const raw = JSON.parse(readFileSync(path.join(detailsDir, name), "utf8"));
        return {
          id: Number(raw.id),
          injury_suspension_status: raw.injury_suspension_status ?? null,
          injury_suspension_status_text: raw.injury_suspension_status_text ?? null,
          played_status: raw.played_status ?? null,
        };
      })
  : [];

const outFile = path.join(ROOT, AVAILABILITY_FILE);
let previous: Snapshot | null = null;
if (existsSync(outFile)) {
  const check = validateAvailability(JSON.parse(readFileSync(outFile, "utf8")));
  previous = check.ok ? check.snapshot : null;
  if (!check.ok) console.warn(`The current ${AVAILABILITY_FILE} is invalid; the diff is against nothing.`);
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

const round = listRoundFor(asOf, fixtures);
const result = importAvailabilityList({
  text: readFileSync(file, "utf8"),
  players,
  asOf,
  round,
  season: AVAILABILITY_SEASON,
  source,
  superCoach,
});

if ("errors" in result) {
  console.error(`Couldn't read ${file}:\n- ${result.errors.join("\n- ")}`);
  process.exit(1);
}

const name = (id: string) => players.find((p) => String(p.id) === id)?.name ?? `#${id}`;

console.log(`List: ${file} (${result.delimiter === "\t" ? "tab" : result.delimiter === "|" ? "pipe" : "comma"}-separated)`);
console.log(`As of ${asOf}; applies to Round ${round}. Source: ${source}.`);

console.log("\nSuperCoach fields seen (fallback for players with no row):");
for (const [field, values] of Object.entries(result.superCoachValues)) {
  const list = Object.entries(values).sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v} × ${n}`);
  console.log(`  ${field}: ${list.join("; ") || "(no files)"}`);
}
console.log(`  Used for ${result.fromSuperCoach} player(s) with no row (unknown values stay "unknown").`);

console.log("\nBy status:");
for (const [status, n] of Object.entries(summariseByStatus(result.snapshot))) {
  console.log(`  ${status.padEnd(11)} ${n}`);
}
const selectedCount = Object.values(result.snapshot.players).filter((p) => p.selected === true).length;
console.log(`  selected    ${selectedCount}`);

const diff = diffSnapshots(previous, result.snapshot);
console.log(`\nChanges since the current file${previous ? ` (as of ${previous.asOf})` : " (none yet)"}:`);
console.log(`  added ${diff.added.length}, removed ${diff.removed.length}, changed ${diff.changed.length}`);
for (const id of diff.added) console.log(`  + ${name(id)}: ${result.snapshot.players[id].status}`);
for (const id of diff.removed) console.log(`  - ${name(id)}`);
for (const c of diff.changed) console.log(`  ~ ${name(c.id)}: ${c.from} -> ${c.to}`);

if (result.problems.length > 0) {
  console.log(`\n${result.problems.length} row(s) not imported:`);
  for (const p of result.problems) {
    console.log(`  line ${p.line}: ${p.player || "(blank)"} ${p.team ? `(${p.team})` : ""}: ${p.kind}, ${p.reason}`);
    for (const s of p.suggestions) console.log(`      did you mean ${s}?`);
  }
}

const check = validateAvailability(result.snapshot);
if (!check.ok) {
  console.error(`\nThe result failed validation (a bug):\n- ${check.errors.join("\n- ")}`);
  process.exit(1);
}

if (result.problems.length > 0 && !allowUnmatched) {
  console.error("\nNothing written. Fix the rows above, or run again with --allow-unmatched to skip them.");
  process.exit(2);
}

if (dryRun) {
  console.log("\nDry run: nothing written.");
} else {
  writeFileSync(outFile, `${JSON.stringify(result.snapshot, null, 2)}\n`);
  console.log(`\nWrote ${AVAILABILITY_FILE} (${Object.keys(result.snapshot.players).length} players). Review with git diff, then commit.`);
}
