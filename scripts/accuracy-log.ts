/**
 * Weekly accuracy log: how well the scaled price model matched a round's
 * published prices. Reads local data only (no network).
 *
 *   node scripts/accuracy-log.ts --round 18
 *   node scripts/accuracy-log.ts --rounds 2-18          # backfill
 *   node scripts/accuracy-log.ts --round 3 --season 2027
 *
 * Writes data/{season}/accuracy/round-NN.json (per player) and updates
 * data/{season}/accuracy/index.json (one summary row per round). Prints a
 * warning and exits non-zero when a round breaks an alert rule:
 *   - average absolute error over $50
 *   - largest error over $300
 *   - fewer than 90% of players within $100
 *   - baseMN re-estimated from the round differs from that season's
 *     constant by more than 10 (skipped if the season has no constant)
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as nodeModule from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { Player } from "@/types/player";

const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Module resolution (same hook as scripts/backtest-pricing.ts): lib/ uses
// extensionless imports and the "@/" alias, which Node does not resolve.
// ---------------------------------------------------------------------------

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
    let target = specifier;

    if (target.startsWith("@/")) {
      target = pathToFileURL(path.join(ROOT, target.slice(2))).href;
    }

    const isLocal = target.startsWith(".") || target.startsWith("file:");

    if (isLocal && !path.extname(target) && context.parentURL) {
      const filePath = fileURLToPath(new URL(target, context.parentURL));

      for (const extension of [".ts", ".tsx"]) {
        if (existsSync(filePath + extension)) {
          return nextResolve(
            pathToFileURL(filePath + extension).href,
            context,
          );
        }
      }
    }

    return nextResolve(target, context);
  },
});

const { evaluateScaledRound } = await import(
  "../lib/priceEngine/evaluateScaledRound"
);
const { buildScaledRoundInputs } = await import(
  "../lib/priceEngine/buildScaledRoundInputs"
);
const { estimateBaseMagicNumber, getBaseMagicNumber } = await import(
  "../lib/priceEngine/baseMagicNumber"
);

// ---------------------------------------------------------------------------
// Alert rules
// ---------------------------------------------------------------------------

const MAX_AVG_ERROR = 50;
const MAX_SINGLE_ERROR = 300;
const MIN_WITHIN_100 = 0.9;
const MAX_BASE_MN_DRIFT = 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayerAccuracyRow {
  playerId: number;
  name: string;
  oldPrice: number;
  modelPrice: number;
  publishedPrice: number;
  error: number;
  threeRoundAverage: number;
}

interface RoundAccuracySummary {
  season: number;
  round: number;
  generatedAt: string;
  /** baseMN used for the model: the season constant, or this round's estimate if none. */
  baseMN: number;
  k: number;
  effectiveMN: number;
  /** Total of all prices after the previous round. */
  anchorTotal: number;
  /** Number of players priced after the previous round (the anchor pool). */
  poolSize: number;
  playersCompared: number;
  avgAbsError: number;
  maxAbsError: number;
  /** Share of compared players within $100, 0 to 1. */
  within100Pct: number;
  /** baseMN re-estimated from this round alone (3b/a regression). */
  estimatedBaseMN: number | null;
  warnings: string[];
}

interface AccuracyIndex {
  season: number;
  updatedAt: string;
  rounds: RoundAccuracySummary[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const value = (flag: string) => {
    const index = args.indexOf(flag);
    return index === -1 ? null : args[index + 1];
  };

  const season = Number(value("--season") ?? 2026);
  const single = value("--round");
  const range = value("--rounds");

  let rounds: number[] = [];

  if (single !== null) {
    rounds = [Number(single)];
  } else if (range !== null) {
    const [from, to] = range.split("-").map(Number);
    rounds = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }

  if (
    !Number.isInteger(season) ||
    rounds.length === 0 ||
    rounds.some((round) => !Number.isInteger(round) || round < 1)
  ) {
    console.error(
      "Usage: node scripts/accuracy-log.ts --round N | --rounds A-B [--season YYYY]",
    );
    process.exit(2);
  }

  return { season, rounds };
}

const money = (value: number) =>
  `$${Math.round(value).toLocaleString("en-AU")}`;

const round2 = (value: number) => Math.round(value * 100) / 100;

function evaluateRound(
  players: Player[],
  season: number,
  round: number,
  baseMN: number,
  seasonConstant: number | null,
): { summary: RoundAccuracySummary; rows: PlayerAccuracyRow[] } | null {
  const evaluation = evaluateScaledRound(players, round, baseMN);

  if (!evaluation) {
    return null;
  }

  const inputs = buildScaledRoundInputs(players, round);
  const inputById = new Map(inputs.players.map((p) => [p.playerId, p]));
  const nameById = new Map(players.map((p) => [p.id, p.name]));

  const rows: PlayerAccuracyRow[] = evaluation.players
    .filter((p) => p.category === "eligible")
    .map((p) => {
      const input = inputById.get(p.playerId)!;
      const publishedPrice = input.actualPrice as number;

      return {
        playerId: p.playerId,
        name: nameById.get(p.playerId) ?? "",
        oldPrice: p.oldPrice,
        modelPrice: p.predictedPrice,
        publishedPrice,
        error: p.predictedPrice - publishedPrice,
        threeRoundAverage: round2(input.threeRoundAverage),
      };
    })
    .sort((a, b) => Math.abs(b.error) - Math.abs(a.error));

  const estimate = estimateBaseMagicNumber(
    rows.map((row) => ({
      oldPrice: row.oldPrice,
      newPrice: row.publishedPrice,
      threeRoundAverage: inputById.get(row.playerId)!.threeRoundAverage,
    })),
  );

  const within100Pct =
    rows.filter((row) => Math.abs(row.error) <= 100).length / rows.length;

  const warnings: string[] = [];

  if (evaluation.averagePriceError > MAX_AVG_ERROR) {
    warnings.push(
      `average error ${money(evaluation.averagePriceError)} is over ${money(MAX_AVG_ERROR)}`,
    );
  }

  if (evaluation.maxPriceError > MAX_SINGLE_ERROR) {
    warnings.push(
      `largest error ${money(evaluation.maxPriceError)} is over ${money(MAX_SINGLE_ERROR)}`,
    );
  }

  if (within100Pct < MIN_WITHIN_100) {
    warnings.push(
      `only ${(within100Pct * 100).toFixed(1)}% within $100 (need ${MIN_WITHIN_100 * 100}%)`,
    );
  }

  if (
    estimate &&
    seasonConstant !== null &&
    Math.abs(estimate.baseMagicNumber - seasonConstant) > MAX_BASE_MN_DRIFT
  ) {
    warnings.push(
      `re-estimated baseMN ${estimate.baseMagicNumber.toFixed(2)} differs from ` +
        `the ${season} constant ${seasonConstant} by more than ${MAX_BASE_MN_DRIFT}`,
    );
  }

  const poolSize = players.filter(
    (player) =>
      player.history.find((h) => h.round === round - 1)?.price != null,
  ).length;

  return {
    rows,
    summary: {
      season,
      round,
      generatedAt: new Date().toISOString(),
      baseMN,
      k: Math.round(evaluation.k * 1e6) / 1e6,
      effectiveMN: round2(evaluation.effectiveMagicNumber),
      anchorTotal: evaluation.anchorTotal,
      poolSize,
      playersCompared: evaluation.playersCompared,
      avgAbsError: round2(evaluation.averagePriceError),
      maxAbsError: evaluation.maxPriceError,
      within100Pct: Math.round(within100Pct * 10000) / 10000,
      estimatedBaseMN: estimate ? round2(estimate.baseMagicNumber) : null,
      warnings,
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { season, rounds } = parseArgs();
  const seasonConstant = getBaseMagicNumber(season);

  console.log(`SuperCoach ${season} accuracy log`);
  console.log("------------------------------");

  if (seasonConstant === null) {
    console.warn(
      `No baseMN constant for ${season} in lib/priceEngine/baseMagicNumber.ts. ` +
        "Add one (see the estimated baseMN below); the baseMN check is skipped.",
    );
  }

  const playersFile = path.resolve(`data/${season}/players-normalised.json`);

  if (!existsSync(playersFile)) {
    console.error(`Missing ${path.relative(ROOT, playersFile)}. Run npm run build:players.`);
    process.exit(2);
  }

  const players = JSON.parse(await readFile(playersFile, "utf8")) as Player[];

  const outputDir = path.resolve(`data/${season}/accuracy`);
  const indexFile = path.join(outputDir, "index.json");

  await mkdir(outputDir, { recursive: true });

  const index: AccuracyIndex = existsSync(indexFile)
    ? JSON.parse(await readFile(indexFile, "utf8"))
    : { season, updatedAt: "", rounds: [] };

  let failed = false;

  for (const round of rounds) {
    // Without a season constant, use this round's own estimate.
    const baseMN =
      seasonConstant ??
      estimateBaseMagicNumber(
        buildScaledRoundInputs(players, round)
          .players.filter((p) => p.category === "eligible" && p.actualPrice !== null)
          .map((p) => ({
            oldPrice: p.oldPrice,
            newPrice: p.actualPrice as number,
            threeRoundAverage: p.threeRoundAverage,
          })),
      )?.baseMagicNumber;

    const result =
      baseMN === undefined
        ? null
        : evaluateRound(players, season, round, baseMN, seasonConstant);

    if (!result) {
      console.warn(`Round ${round}: no price changes to compare, skipped.`);
      continue;
    }

    const { summary, rows } = result;
    const file = path.join(outputDir, `round-${String(round).padStart(2, "0")}.json`);

    await writeFile(
      file,
      `${JSON.stringify({ ...summary, players: rows }, null, 2)}\n`,
      "utf8",
    );

    index.rounds = [
      ...index.rounds.filter((r) => r.round !== round),
      summary,
    ].sort((a, b) => a.round - b.round);

    const status = summary.warnings.length === 0 ? "ok" : "WARNING";

    console.log(
      `R${String(round).padStart(2)}  ${status.padEnd(7)}  ` +
        `avg $${summary.avgAbsError.toFixed(2).padStart(6)}  ` +
        `max ${money(summary.maxAbsError).padStart(6)}  ` +
        `≤$100 ${(summary.within100Pct * 100).toFixed(1).padStart(5)}%  ` +
        `k ${summary.k.toFixed(6)}  ` +
        `est baseMN ${summary.estimatedBaseMN ?? "-"}  ` +
        `(${summary.playersCompared} players)`,
    );

    for (const warning of summary.warnings) {
      console.warn(`     ! ${warning}`);
      failed = true;
    }
  }

  index.season = season;
  index.updatedAt = new Date().toISOString();

  await writeFile(indexFile, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  console.log("");
  console.log(`Index: ${path.relative(ROOT, indexFile)}`);

  if (failed) {
    console.error("One or more rounds broke an alert rule (see warnings above).");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
