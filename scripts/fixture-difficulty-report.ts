/**
 * Prints the distribution of fixture difficulty values (Position cells,
 * Fixture cells and Teams Net) as of a round and for the full season, with
 * the share of cells in each colour band. Local data only.
 *
 *   node scripts/fixture-difficulty-report.ts [round ...]   (default: 10 and full season)
 */

import { existsSync, readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { DifficultyBand } from "../lib/fixtureDifficulty/colour";
import type { FixtureGame } from "../lib/fixtureDifficulty/fixtureDifficulty";
import type { Player } from "../types/player";

const ROOT = process.cwd();

type ResolveHook = (
  specifier: string,
  context: { parentURL?: string },
  nextResolve: (specifier: string, context: { parentURL?: string }) => unknown,
) => unknown;
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { resolve: ResolveHook }) => void };

// lib/ uses extensionless imports, which Node doesn't resolve.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const isLocal = specifier.startsWith(".") || specifier.startsWith("file:");
    if (isLocal && !path.extname(specifier) && context.parentURL) {
      const filePath = fileURLToPath(new URL(specifier, context.parentURL));
      if (existsSync(`${filePath}.ts`)) return nextResolve(pathToFileURL(`${filePath}.ts`).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { trimFixturesToRound, trimPlayersToRound } = await import("../lib/asOf/trimToRound");
const { difficultyBand, teamNetBand } = await import("../lib/fixtureDifficulty/colour");
const { POSITION_GROUPS, POSITION_COLOUR_THRESHOLD, TEAM_NET_COLOUR_THRESHOLD } = await import("../lib/fixtureDifficulty/config");
const { buildFixtureRows } = await import("../lib/fixtureDifficulty/fixtureDifficulty");
const { computePositionDifficulty } = await import("../lib/fixtureDifficulty/positionDifficulty");
const { computeTeamDifficulty } = await import("../lib/fixtureDifficulty/teamDifficulty");
const players = JSON.parse(readFileSync(path.join(ROOT, "data/2026/players-normalised.json"), "utf8")) as Player[];
const fixtureFile = JSON.parse(readFileSync(path.join(ROOT, "data/2026/fixtures-raw.json"), "utf8"));
const fixtures: FixtureGame[] = fixtureFile.rounds.flatMap((r: { round: number; response: { team1: { abbrev: string }; team2: { abbrev: string } }[] }) =>
  r.response.map((g) => ({ round: r.round, homeTeam: g.team1.abbrev, awayTeam: g.team2.abbrev })),
);
const FINAL_ROUND = Math.max(...fixtures.map((f) => f.round));
const teams = [...new Set(fixtures.flatMap((f) => [f.homeTeam, f.awayTeam]))].sort();

function quantile(sorted: number[], q: number) {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function describe(label: string, values: number[], band: (v: number) => DifficultyBand) {
  const sorted = [...values].sort((a, b) => a - b);
  const share = (b: DifficultyBand) => `${((values.filter((v) => band(v) === b).length / values.length) * 100).toFixed(0)}%`;
  const f = (v: number) => (Number.isNaN(v) ? "-" : v.toFixed(1));
  console.log(
    `  ${label.padEnd(16)} n=${String(values.length).padStart(4)}  min ${f(sorted[0])}  p10 ${f(quantile(sorted, 0.1))}  p25 ${f(quantile(sorted, 0.25))}  median ${f(quantile(sorted, 0.5))}  p75 ${f(quantile(sorted, 0.75))}  p90 ${f(quantile(sorted, 0.9))}  max ${f(sorted[sorted.length - 1])}` +
      `  |  green ${share("easy")}  neutral ${share("neutral")}  red ${share("hard")}`,
  );
}

function report(asOf: number | null) {
  const round = asOf ?? FINAL_ROUND;
  const asOfPlayers = asOf === null ? players : trimPlayersToRound(players, trimFixturesToRound(fixtureFile, asOf), asOf);
  const difficulty = computePositionDifficulty(asOfPlayers, round);

  const positionCells = [...difficulty.values()].flatMap((cells) =>
    POSITION_GROUPS.map((p) => cells[p]?.value).filter((v): v is number => typeof v === "number"),
  );

  // Fixture cells as the page shows them: future rounds, or the whole season when none remain.
  const hasFuture = fixtures.some((f) => f.round > round);
  const fixtureCells = POSITION_GROUPS.flatMap((position) =>
    buildFixtureRows({ fixtures, difficulty, position, asOfRound: round, fromRound: hasFuture ? round + 1 : 0, lastRound: FINAL_ROUND, teams }).flatMap(
      (row) => row.cells.filter((c) => !c.bye && c.value !== null).map((c) => c.value as number),
    ),
  );

  const nets = computeTeamDifficulty(asOfPlayers, round).map((t) => t.net);

  console.log(`\n${asOf === null ? "Full season (to Round " + FINAL_ROUND + ")" : "As of Round " + asOf}:`);
  describe(`Position (±${POSITION_COLOUR_THRESHOLD})`, positionCells, (v) => difficultyBand(v));
  describe(`Fixture (±${POSITION_COLOUR_THRESHOLD})`, fixtureCells, (v) => difficultyBand(v));
  describe(`Team Net (±${TEAM_NET_COLOUR_THRESHOLD})`, nets, teamNetBand);
}

const rounds = process.argv.slice(2).map(Number).filter(Number.isInteger);
for (const r of rounds.length > 0 ? rounds : [10]) report(r);
report(null);
