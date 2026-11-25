/**
 * Development-only backtest for the DEBUG_AS_OF_ROUND lock (and the trade
 * planner): what the Projector would have shown straight after Round N,
 * beside the prices actually published later.
 *
 *   node scripts/as-of-backtest.ts 10
 *   node scripts/as-of-backtest.ts 10 --mode three-round-average
 *   node scripts/as-of-backtest.ts 10 --player 810
 *
 * Projections come from the app's own Projector code (buildPlayerRows +
 * calculateScaledProjectionRows) running under the lock, so they see only
 * Round 0..N. Actual prices are read straight from the stored data.
 * Prints the error per round and writes a per-player CSV to
 * scripts/output/as-of-backtest-round-N.csv. Reads local data only.
 *
 * Note: like the Projector, projections assume every player plays every
 * remaining round, so injured or dropped players show large errors.
 */

import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import * as nodeModule from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { Player } from "@/types/player";

const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Arguments (the lock must be set before any app module is imported)
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
};

const asOfRound = Number(args[0]);
const mode = flag("--mode") ?? "projected";
const playerFilter = flag("--player");

if (!Number.isInteger(asOfRound) || asOfRound < 1 || asOfRound > 23) {
  console.error(
    "Usage: node scripts/as-of-backtest.ts <round 1-23> [--mode projected|season-average|three-round-average|five-round-average] [--player id]",
  );
  process.exit(2);
}

process.env.DEBUG_AS_OF_ROUND = String(asOfRound);

// ---------------------------------------------------------------------------
// Module resolution: "@/" alias, extensionless imports, and JSON imports
// (the app imports JSON without import attributes, which Node rejects).
// ---------------------------------------------------------------------------

type Hook<Context, Result> = (
  specifier: string,
  context: Context,
  next: (specifier: string, context: Context) => Result,
) => Result;

const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: {
    resolve: Hook<{ parentURL?: string }, unknown>;
    load: Hook<object, { source?: unknown; format?: string }>;
  }) => void;
};

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
  load(url, context, nextLoad) {
    if (url.endsWith(".json")) {
      return {
        format: "module",
        source: `export default ${readFileSync(fileURLToPath(url), "utf8")};`,
        shortCircuit: true,
      } as { source: string; format: string };
    }

    return nextLoad(url, context);
  },
});

const { playerRepository } = await import(
  "../lib/repository/PlayerRepository"
);
const { buildPlayerRows } = await import("../lib/projector/buildPlayerRows");
const { calculateScaledProjectionRows } = await import(
  "../lib/projector/calculateScaledProjectionRows"
);
const { CURRENT_COMPLETED_ROUND } = await import("../data/season");

type ProjectionMode = Parameters<typeof buildPlayerRows>[1];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const money = (value: number) =>
  `${value < 0 ? "−" : ""}$${Math.abs(Math.round(value)).toLocaleString("en-AU")}`;

function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
}

async function main() {
  if (CURRENT_COMPLETED_ROUND !== asOfRound) {
    throw new Error("The as-of lock did not apply.");
  }

  // Real published data, read from disk (never through the locked modules).
  const actualPlayers = JSON.parse(
    readFileSync(path.resolve("data/2026/players-normalised.json"), "utf8"),
  ) as Player[];
  const actualById = new Map(actualPlayers.map((p) => [p.id, p]));

  const csvRows: Record<string, string | number>[] = [];
  const byRound = new Map<number, number[]>();

  for (const player of playerRepository.getAll()) {
    if (playerFilter !== null && String(player.id) !== playerFilter) {
      continue;
    }

    const projected = calculateScaledProjectionRows(
      buildPlayerRows(player, mode as ProjectionMode),
      player,
    );

    const actual = actualById.get(player.id);

    for (const row of projected) {
      if (row.round <= asOfRound || row.price === null) {
        continue;
      }

      const actualRow = actual?.history.find((h) => h.round === row.round);
      const actualPrice = actualRow?.price ?? null;
      const error = actualPrice === null ? null : row.price - actualPrice;

      if (error !== null) {
        byRound.set(row.round, [...(byRound.get(row.round) ?? []), error]);
      }

      csvRows.push({
        asOfRound,
        mode,
        round: row.round,
        playerId: player.id,
        player: player.name,
        team: player.team,
        projectedScore: row.score ?? "",
        actualScore:
          actualRow && actualRow.games > 0 ? (actualRow.score ?? "") : "",
        projectedPrice: row.price,
        actualPrice: actualPrice ?? "",
        error: error ?? "",
      });
    }
  }

  console.log(
    `As of Round ${asOfRound} (mode: ${mode}): projected vs published prices`,
  );
  console.log("-".repeat(66));

  if (playerFilter !== null && csvRows.length === 0) {
    console.log(
      `Player ${playerFilter} did not exist as of Round ${asOfRound} (added later, or unknown id).`,
    );
    return;
  }

  if (playerFilter !== null) {
    console.table(
      csvRows.map((row) => ({
        round: row.round,
        projScore: row.projectedScore,
        actualScore: row.actualScore,
        projected: money(Number(row.projectedPrice)),
        actual: row.actualPrice === "" ? "-" : money(Number(row.actualPrice)),
        error: row.error === "" ? "-" : money(Number(row.error)),
      })),
    );
  }

  console.table(
    [...byRound.entries()]
      .sort(([a], [b]) => a - b)
      .map(([round, errors]) => {
        const abs = errors.map(Math.abs).sort((a, b) => a - b);

        return {
          round,
          roundsAhead: round - asOfRound,
          players: errors.length,
          avgAbsError: money(abs.reduce((t, e) => t + e, 0) / abs.length),
          medianAbsError: money(abs[Math.floor(abs.length / 2)]),
          meanSignedError: money(errors.reduce((t, e) => t + e, 0) / errors.length),
          within10k: `${((100 * abs.filter((e) => e <= 10_000).length) / abs.length).toFixed(1)}%`,
          within25k: `${((100 * abs.filter((e) => e <= 25_000).length) / abs.length).toFixed(1)}%`,
        };
      }),
  );

  const outputDir = path.resolve("scripts/output");
  await mkdir(outputDir, { recursive: true });

  const file = path.join(
    outputDir,
    `as-of-backtest-round-${asOfRound}${playerFilter ? `-player-${playerFilter}` : ""}.csv`,
  );
  await writeFile(file, toCsv(csvRows), "utf8");

  console.log(`CSV: ${path.relative(ROOT, file)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
